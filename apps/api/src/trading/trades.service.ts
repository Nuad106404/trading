import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';
import { PushService } from '../push/push.service';
import { BulkImportDto, CreateTradeDto, QueryTradesDto, UpdateTradeDto } from './dto/trade.dto';
import { CashTransaction, CashTransactionDocument } from './schemas/cash-transaction.schema';
import {
  NET_PROFIT_EXPR,
  Trade,
  TradeDocument,
  TradingSource,
} from './schemas/trade.schema';
import { computeGrossProfit } from './trading.util';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);

  constructor(
    @InjectModel(Trade.name) private readonly tradeModel: Model<TradeDocument>,
    @InjectModel(CashTransaction.name)
    private readonly cashModel: Model<CashTransactionDocument>,
    private readonly pushService: PushService,
    private readonly config: ConfigService,
  ) {}

  async findAll(userId: string, query: QueryTradesDto) {
    const filter: FilterQuery<TradeDocument> = { userId: new Types.ObjectId(userId) };

    if (query.symbol) filter.symbol = query.symbol;
    if (query.side) filter.side = query.side;
    if (query.from || query.to) {
      filter.closeTime = {};
      if (query.from) filter.closeTime.$gte = new Date(query.from);
      if (query.to) filter.closeTime.$lte = new Date(query.to);
    }
    if (query.result) {
      // netProfit is derived, so filter with an expression
      filter.$expr =
        query.result === 'win'
          ? { $gt: [NET_PROFIT_EXPR, 0] }
          : { $lte: [NET_PROFIT_EXPR, 0] };
    }
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ symbol: rx }, { notes: rx }, { tags: rx }];
    }

    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
      _id: -1, // stable pagination for equal keys
    };

    const [data, total] = await Promise.all([
      this.tradeModel
        .find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.tradeModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(userId: string, id: string): Promise<TradeDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException('Trade not found.');
    // scoping by userId makes someone else's id indistinguishable from a missing one (404)
    const trade = await this.tradeModel
      .findOne({ _id: id, userId: new Types.ObjectId(userId) })
      .exec();
    if (!trade) throw new NotFoundException('Trade not found.');
    return trade;
  }

  async create(userId: string, dto: CreateTradeDto): Promise<TradeDocument> {
    const trade = await this.tradeModel.create({
      ...this.toTradeData(dto),
      userId: new Types.ObjectId(userId),
      source: TradingSource.MANUAL,
    });
    this.maybeAlertLargeLoss(userId, trade);
    return trade;
  }

  async update(userId: string, id: string, dto: UpdateTradeDto): Promise<TradeDocument> {
    const trade = await this.findOne(userId, id);
    // class-transformer materializes undefined own-properties on DTO instances;
    // strip them so a partial PATCH can't wipe existing required fields
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    Object.assign(trade, this.toTradeData({ ...trade.toObject(), ...patch } as CreateTradeDto));
    await trade.save();
    return trade;
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const trade = await this.findOne(userId, id);
    await this.tradeModel.deleteOne({ _id: trade._id }).exec();
    return { deleted: true };
  }

  /**
   * File import: the client parses MT5 exports into JSON; we only trust the
   * JWT for ownership and force source='import' on every row.
   *
   * Duplicate protection: rows that match an existing entry (same broker
   * ticket, or same symbol/side/lots/close-time/profit) are skipped, so
   * re-uploading the same or an overlapping export never doubles the data.
   */
  async bulkImport(userId: string, dto: BulkImportDto) {
    const owner = new Types.ObjectId(userId);

    // existing keys for this user (both ticket-based and composite)
    const existingTrades = await this.tradeModel
      .find({ userId: owner })
      .select('ticket symbol side lots closeTime profit')
      .lean()
      .exec();
    const seenTradeKeys = new Set<string>(existingTrades.flatMap((t) => this.tradeKeys(t)));

    const existingCash = await this.cashModel
      .find({ userId: owner })
      .select('type amount date')
      .lean()
      .exec();
    const seenCashKeys = new Set<string>(existingCash.map((c) => this.cashKey(c)));

    const newTrades: Record<string, any>[] = [];
    let skippedTrades = 0;
    for (const input of dto.trades) {
      const data = this.toTradeData(input);
      const keys = this.tradeKeys(data);
      if (keys.some((key) => seenTradeKeys.has(key))) {
        skippedTrades++;
        continue;
      }
      keys.forEach((key) => seenTradeKeys.add(key)); // in-batch dedup too
      newTrades.push({ ...data, userId: owner, source: TradingSource.IMPORT });
    }

    const newCash: Record<string, any>[] = [];
    let skippedTransactions = 0;
    for (const input of dto.transactions) {
      const data = {
        type: input.type,
        amount: input.amount,
        date: new Date(input.date),
        note: input.note,
      };
      const key = this.cashKey(data);
      if (seenCashKeys.has(key)) {
        skippedTransactions++;
        continue;
      }
      seenCashKeys.add(key);
      newCash.push({ ...data, userId: owner, source: TradingSource.IMPORT });
    }

    const trades = newTrades.length > 0 ? await this.tradeModel.insertMany(newTrades) : [];
    const transactions = newCash.length > 0 ? await this.cashModel.insertMany(newCash) : [];

    return {
      importedTrades: trades.length,
      importedTransactions: transactions.length,
      skippedTrades,
      skippedTransactions,
    };
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Identity keys for import dedup. Time is floored to the second because
   * different MT5 exports carry different precision (report: seconds,
   * mobile journal: milliseconds). The composite key also matches rows that
   * were imported before tickets existed.
   */
  private tradeKeys(t: {
    ticket?: string | null;
    symbol: string;
    side: string;
    lots: number;
    closeTime?: Date | null;
    profit?: number | null;
  }): string[] {
    const closeSec = t.closeTime ? Math.floor(new Date(t.closeTime).getTime() / 1000) : '';
    const profit = Math.round((t.profit ?? 0) * 100) / 100;
    const keys = [`c|${t.symbol}|${t.side}|${t.lots}|${closeSec}|${profit}`];
    if (t.ticket) keys.unshift(`t|${t.ticket}|${closeSec}`);
    return keys;
  }

  private cashKey(c: { type: string; amount: number; date: Date }): string {
    return `${c.type}|${c.amount}|${Math.floor(new Date(c.date).getTime() / 1000)}`;
  }

  /** Normalizes a DTO into schema fields, deriving gross profit when absent. */
  private toTradeData(src: CreateTradeDto) {
    let profit = src.profit;
    if (
      (profit === undefined || profit === null) &&
      src.openPrice != null &&
      src.closePrice != null &&
      src.lots != null &&
      src.side
    ) {
      // round to cents — float noise here would leak into stats and dedup keys
      profit = Math.round(computeGrossProfit(src.side, src.openPrice, src.closePrice, src.lots) * 100) / 100;
    }
    return {
      symbol: src.symbol,
      ticket: src.ticket,
      side: src.side,
      lots: src.lots,
      openPrice: src.openPrice,
      closePrice: src.closePrice,
      sl: src.sl,
      tp: src.tp,
      openTime: src.openTime ? new Date(src.openTime) : undefined,
      closeTime: src.closeTime ? new Date(src.closeTime) : undefined,
      commission: src.commission ?? 0,
      swap: src.swap ?? 0,
      profit: profit ?? 0,
      tags: src.tags,
      notes: src.notes,
    };
  }

  /** Push alert when a single (manual) trade loses more than the threshold. */
  private maybeAlertLargeLoss(userId: string, trade: TradeDocument): void {
    const threshold = this.config.get<number>('trading.lossAlertThreshold', 100);
    const netProfit = (trade.profit ?? 0) + (trade.commission ?? 0) + (trade.swap ?? 0);
    if (threshold <= 0 || netProfit > -threshold) return;

    this.pushService
      .sendToUser(userId, {
        title: '⚠️ Large loss recorded',
        body: `-$${Math.abs(netProfit).toFixed(2)} on ${trade.symbol} (${trade.side}, ${trade.lots} lots)`,
        url: '/trading/trades',
        tag: 'trading-large-loss',
      })
      .catch((err) => this.logger.warn(`Large-loss push failed: ${err?.message}`));
  }
}
