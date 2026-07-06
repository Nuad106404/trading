import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CashTransaction,
  CashTransactionDocument,
  CashType,
  SIGNED_AMOUNT_EXPR,
} from './schemas/cash-transaction.schema';
import { NET_PROFIT_EXPR, Trade, TradeDocument } from './schemas/trade.schema';

export interface EquityPoint {
  ts: string | null;
  balance: number;
  type: 'trade' | 'deposit' | 'withdrawal';
  delta: number;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(Trade.name) private readonly tradeModel: Model<TradeDocument>,
    @InjectModel(CashTransaction.name)
    private readonly cashModel: Model<CashTransactionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async summary(userId: string) {
    const owner = new Types.ObjectId(userId);

    const [tradeAgg] = await this.tradeModel.aggregate([
      { $match: { userId: owner } },
      { $addFields: { net: NET_PROFIT_EXPR } },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          netProfit: { $sum: '$net' },
          wins: { $sum: { $cond: [{ $gt: ['$net', 0] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $lte: ['$net', 0] }, 1, 0] } },
          grossWin: { $sum: { $cond: [{ $gt: ['$net', 0] }, '$net', 0] } },
          grossLoss: { $sum: { $cond: [{ $lte: ['$net', 0] }, '$net', 0] } },
          totalCommission: { $sum: '$commission' },
          totalSwap: { $sum: '$swap' },
          totalLots: { $sum: '$lots' },
          largestWin: { $max: '$net' },
          largestLoss: { $min: '$net' },
        },
      },
    ]);

    const [cashAgg] = await this.cashModel.aggregate([
      { $match: { userId: owner } },
      {
        $group: {
          _id: null,
          deposits: {
            $sum: { $cond: [{ $eq: ['$type', CashType.DEPOSIT] }, '$amount', 0] },
          },
          withdrawals: {
            $sum: { $cond: [{ $eq: ['$type', CashType.WITHDRAWAL] }, '$amount', 0] },
          },
        },
      },
    ]);

    const t = tradeAgg ?? {
      totalTrades: 0,
      netProfit: 0,
      wins: 0,
      losses: 0,
      grossWin: 0,
      grossLoss: 0,
      totalCommission: 0,
      totalSwap: 0,
      totalLots: 0,
      largestWin: 0,
      largestLoss: 0,
    };
    const deposits = cashAgg?.deposits ?? 0;
    const withdrawals = cashAgg?.withdrawals ?? 0;

    const { maxWinStreak, maxLossStreak } = await this.streaks(owner);

    const avgWin = t.wins > 0 ? t.grossWin / t.wins : 0;
    const avgLoss = t.losses > 0 ? t.grossLoss / t.losses : 0; // negative
    const winrate = t.totalTrades > 0 ? t.wins / t.totalTrades : 0;

    return {
      balance: deposits - withdrawals + t.netProfit,
      netProfit: t.netProfit,
      winrate,
      // null = no losses yet (frontend renders ∞)
      profitFactor:
        t.grossLoss !== 0 ? t.grossWin / Math.abs(t.grossLoss) : t.grossWin > 0 ? null : 0,
      avgWin,
      avgLoss,
      rr: avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0,
      totalTrades: t.totalTrades,
      wins: t.wins,
      losses: t.losses,
      maxWinStreak,
      maxLossStreak,
      totalCommission: t.totalCommission,
      totalSwap: t.totalSwap,
      deposits,
      withdrawals,
      totalLots: t.totalLots,
      largestWin: t.totalTrades > 0 ? t.largestWin : 0,
      largestLoss: t.totalTrades > 0 ? t.largestLoss : 0,
      expectancy: t.totalTrades > 0 ? t.netProfit / t.totalTrades : 0,
    };
  }

  /**
   * Trade + cash events merged into one sorted timeline with a running balance.
   * The merge/sort happens in Mongo ($unionWith); only the single running-sum
   * pass runs in JS.
   */
  async equityCurve(userId: string): Promise<EquityPoint[]> {
    const owner = new Types.ObjectId(userId);

    const events: Array<{ ts: Date | null; delta: number; type: EquityPoint['type'] }> =
      await this.cashModel.aggregate([
        { $match: { userId: owner } },
        { $project: { _id: 0, ts: '$date', delta: SIGNED_AMOUNT_EXPR, type: '$type' } },
        {
          $unionWith: {
            coll: this.tradeModel.collection.name,
            pipeline: [
              { $match: { userId: owner } },
              {
                $project: {
                  _id: 0,
                  ts: { $ifNull: ['$closeTime', { $ifNull: ['$openTime', '$createdAt'] }] },
                  delta: NET_PROFIT_EXPR,
                  type: { $literal: 'trade' },
                },
              },
            ],
          },
        },
        { $sort: { ts: 1 } },
      ]);

    let balance = 0;
    return events.map((e) => {
      balance += e.delta;
      return {
        ts: e.ts ? new Date(e.ts).toISOString() : null,
        balance: Math.round(balance * 100) / 100,
        type: e.type,
        delta: Math.round(e.delta * 100) / 100,
      };
    });
  }

  async monthly(userId: string) {
    const rows = await this.tradeModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $addFields: {
          net: NET_PROFIT_EXPR,
          ts: { $ifNull: ['$closeTime', { $ifNull: ['$openTime', '$createdAt'] }] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$ts' } },
          netProfit: { $sum: '$net' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: '$_id', netProfit: 1, count: 1 } },
    ]);
    return rows;
  }

  async bySymbol(userId: string) {
    return this.tradeModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $addFields: { net: NET_PROFIT_EXPR } },
      {
        $group: {
          _id: '$symbol',
          netProfit: { $sum: '$net' },
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $gt: ['$net', 0] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          symbol: '$_id',
          netProfit: 1,
          count: 1,
          winrate: { $cond: [{ $gt: ['$count', 0] }, { $divide: ['$wins', '$count'] }, 0] },
        },
      },
      { $sort: { netProfit: -1 } },
    ]);
  }

  /**
   * Max drawdown of TRADING performance. Deposits/withdrawals are not
   * trading results, so each cash event shifts the reference peak by the
   * same amount instead of registering as a gain/loss — matching how MT5's
   * "Balance Drawdown Maximal" behaves (a withdrawal after profits does
   * not show up as a crash in the stats).
   */
  async maxDrawdown(userId: string) {
    const curve = await this.equityCurve(userId);
    let peak = 0;
    let peakAt: string | null = null;
    let maxDd = 0;
    let maxDdPercent = 0;
    let ddPeakAt: string | null = null;
    let troughAt: string | null = null;

    for (const point of curve) {
      if (point.type !== 'trade') {
        // cash flow: move the peak with the balance (never below it)
        peak = Math.max(peak + point.delta, point.balance);
        if (peak === point.balance) peakAt = point.ts;
        continue;
      }
      if (point.balance > peak) {
        peak = point.balance;
        peakAt = point.ts;
      }
      const dd = peak - point.balance;
      if (dd > maxDd) {
        maxDd = dd;
        maxDdPercent = peak > 0 ? dd / peak : 0;
        ddPeakAt = peakAt;
        troughAt = point.ts;
      }
    }

    return {
      amount: Math.round(maxDd * 100) / 100,
      percent: maxDdPercent,
      peakAt: ddPeakAt,
      troughAt,
    };
  }

  /**
   * Read-only oversight for superadmin/admin: per-user aggregates only,
   * never someone else's editable data.
   */
  async adminOverview() {
    const tradeRows: Array<{
      _id: Types.ObjectId;
      totalTrades: number;
      netProfit: number;
      lastTradeAt: Date | null;
    }> = await this.tradeModel.aggregate([
      { $addFields: { net: NET_PROFIT_EXPR } },
      {
        $group: {
          _id: '$userId',
          totalTrades: { $sum: 1 },
          netProfit: { $sum: '$net' },
          lastTradeAt: { $max: { $ifNull: ['$closeTime', '$createdAt'] } },
        },
      },
    ]);

    const cashRows: Array<{ _id: Types.ObjectId; cashNet: number }> =
      await this.cashModel.aggregate([
        { $group: { _id: '$userId', cashNet: { $sum: SIGNED_AMOUNT_EXPR } } },
      ]);

    const byUser = new Map<
      string,
      { totalTrades: number; netProfit: number; lastTradeAt: Date | null; cashNet: number }
    >();
    for (const row of tradeRows) {
      byUser.set(row._id.toString(), {
        totalTrades: row.totalTrades,
        netProfit: row.netProfit,
        lastTradeAt: row.lastTradeAt,
        cashNet: 0,
      });
    }
    for (const row of cashRows) {
      const key = row._id.toString();
      const entry = byUser.get(key) ?? {
        totalTrades: 0,
        netProfit: 0,
        lastTradeAt: null,
        cashNet: 0,
      };
      entry.cashNet = row.cashNet;
      byUser.set(key, entry);
    }

    if (byUser.size === 0) return [];

    const users = await this.userModel
      .find({ _id: { $in: [...byUser.keys()].map((id) => new Types.ObjectId(id)) } })
      .select('username')
      .exec();
    const usernames = new Map(users.map((u) => [u._id.toString(), u.username]));

    return [...byUser.entries()]
      .map(([userId, s]) => ({
        userId,
        username: usernames.get(userId) ?? '(deleted user)',
        totalTrades: s.totalTrades,
        netProfit: Math.round(s.netProfit * 100) / 100,
        balance: Math.round((s.cashNet + s.netProfit) * 100) / 100,
        lastTradeAt: s.lastTradeAt,
      }))
      .sort((a, b) => b.netProfit - a.netProfit);
  }

  // ---------------------------------------------------------------- helpers

  /** Longest consecutive win/loss runs, ordered by close time. */
  private async streaks(owner: Types.ObjectId) {
    // project only the sign of each trade — cheap even for large journals
    const rows: Array<{ win: boolean }> = await this.tradeModel.aggregate([
      { $match: { userId: owner } },
      {
        $addFields: {
          ts: { $ifNull: ['$closeTime', { $ifNull: ['$openTime', '$createdAt'] }] },
        },
      },
      { $sort: { ts: 1 } },
      { $project: { _id: 0, win: { $gt: [NET_PROFIT_EXPR, 0] } } },
    ]);

    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentWin = 0;
    let currentLoss = 0;
    for (const { win } of rows) {
      if (win) {
        currentWin++;
        currentLoss = 0;
        if (currentWin > maxWinStreak) maxWinStreak = currentWin;
      } else {
        currentLoss++;
        currentWin = 0;
        if (currentLoss > maxLossStreak) maxLossStreak = currentLoss;
      }
    }
    return { maxWinStreak, maxLossStreak };
  }
}
