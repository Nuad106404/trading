import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushService } from '../push/push.service';
import { NET_PROFIT_EXPR, Trade, TradeDocument } from './schemas/trade.schema';

/**
 * Daily trading summary — 23:00 Asia/Bangkok. Every user with trades closed
 * that (Thai) day gets a push with their day's net P&L.
 */
@Injectable()
export class TradingNotificationsService {
  private readonly logger = new Logger(TradingNotificationsService.name);

  constructor(
    @InjectModel(Trade.name) private readonly tradeModel: Model<TradeDocument>,
    private readonly pushService: PushService,
  ) {}

  @Cron('0 0 23 * * *', { timeZone: 'Asia/Bangkok' })
  async sendDailySummaries(): Promise<void> {
    const { start, end } = this.bangkokDayRange();

    const rows: Array<{
      _id: Types.ObjectId;
      netProfit: number;
      count: number;
      wins: number;
    }> = await this.tradeModel.aggregate([
      { $match: { closeTime: { $gte: start, $lte: end } } },
      { $addFields: { net: NET_PROFIT_EXPR } },
      {
        $group: {
          _id: '$userId',
          netProfit: { $sum: '$net' },
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $gt: ['$net', 0] }, 1, 0] } },
        },
      },
    ]);

    for (const row of rows) {
      const sign = row.netProfit >= 0 ? '+' : '-';
      const emoji = row.netProfit >= 0 ? '📈' : '📉';
      await this.pushService
        .sendToUser(row._id.toString(), {
          title: `${emoji} Daily trading summary`,
          body: `${sign}$${Math.abs(row.netProfit).toFixed(2)} today · ${row.count} trade${row.count === 1 ? '' : 's'}, ${row.wins} win${row.wins === 1 ? '' : 's'}`,
          url: '/trading',
          tag: 'trading-daily-summary',
        })
        .catch((err) => this.logger.warn(`Daily summary push failed: ${err?.message}`));
    }

    if (rows.length > 0) {
      this.logger.log(`Sent daily trading summaries to ${rows.length} user(s).`);
    }
  }

  /** Current day in Asia/Bangkok (UTC+7, no DST) as a UTC range. */
  private bangkokDayRange(): { start: Date; end: Date } {
    const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowBkk = Date.now() + BKK_OFFSET_MS;
    const dayStartBkk = Math.floor(nowBkk / 86_400_000) * 86_400_000;
    return {
      start: new Date(dayStartBkk - BKK_OFFSET_MS),
      end: new Date(dayStartBkk - BKK_OFFSET_MS + 86_400_000 - 1),
    };
  }
}
