import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';
import { CreateCashDto, QueryCashDto, UpdateCashDto } from './dto/trade.dto';
import {
  CashTransaction,
  CashTransactionDocument,
} from './schemas/cash-transaction.schema';
import { TradingSource } from './schemas/trade.schema';
import { TradingEventsService } from './trading-events.service';

@Injectable()
export class CashService {
  constructor(
    @InjectModel(CashTransaction.name)
    private readonly cashModel: Model<CashTransactionDocument>,
    private readonly events: TradingEventsService,
  ) {}

  async findAll(userId: string, query: QueryCashDto) {
    const filter: FilterQuery<CashTransactionDocument> = {
      userId: new Types.ObjectId(userId),
    };
    if (query.type) filter.type = query.type;
    if (query.from || query.to) {
      filter.date = {};
      if (query.from) filter.date.$gte = new Date(query.from);
      if (query.to) filter.date.$lte = new Date(query.to);
    }
    return this.cashModel.find(filter).sort({ date: -1, _id: -1 }).exec();
  }

  async create(userId: string, dto: CreateCashDto): Promise<CashTransactionDocument> {
    const tx = await this.cashModel.create({
      type: dto.type,
      amount: dto.amount,
      date: new Date(dto.date),
      note: dto.note,
      userId: new Types.ObjectId(userId),
      source: TradingSource.MANUAL,
    });
    this.events.emit(userId, ['cash', 'stats']);
    return tx;
  }

  async update(userId: string, id: string, dto: UpdateCashDto): Promise<CashTransactionDocument> {
    const tx = await this.findOne(userId, id);
    if (dto.type !== undefined) tx.type = dto.type;
    if (dto.amount !== undefined) tx.amount = dto.amount;
    if (dto.date !== undefined) tx.date = new Date(dto.date);
    if (dto.note !== undefined) tx.note = dto.note;
    await tx.save();
    this.events.emit(userId, ['cash', 'stats']);
    return tx;
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const tx = await this.findOne(userId, id);
    await this.cashModel.deleteOne({ _id: tx._id }).exec();
    this.events.emit(userId, ['cash', 'stats']);
    return { deleted: true };
  }

  /** Owner-scoped bulk delete — foreign ids simply don't match and are ignored. */
  async bulkRemove(userId: string, ids: string[]): Promise<{ deleted: number }> {
    const result = await this.cashModel
      .deleteMany({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        userId: new Types.ObjectId(userId),
      })
      .exec();
    const deleted = result.deletedCount ?? 0;
    if (deleted > 0) this.events.emit(userId, ['cash', 'stats']);
    return { deleted };
  }

  private async findOne(userId: string, id: string): Promise<CashTransactionDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException('Transaction not found.');
    const tx = await this.cashModel
      .findOne({ _id: id, userId: new Types.ObjectId(userId) })
      .exec();
    if (!tx) throw new NotFoundException('Transaction not found.');
    return tx;
  }
}
