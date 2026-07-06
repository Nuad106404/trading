import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PushModule } from '../push/push.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import {
  CashTransaction,
  CashTransactionSchema,
} from './schemas/cash-transaction.schema';
import { Trade, TradeSchema } from './schemas/trade.schema';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { TradingAdminController } from './trading-admin.controller';
import { TradingAdminService } from './trading-admin.service';
import { TradingEventsController } from './trading-events.controller';
import { TradingEventsService } from './trading-events.service';
import { TradingNotificationsService } from './trading-notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Trade.name, schema: TradeSchema },
      { name: CashTransaction.name, schema: CashTransactionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PushModule,
  ],
  controllers: [
    TradesController,
    CashController,
    StatsController,
    TradingAdminController,
    TradingEventsController,
  ],
  providers: [
    TradesService,
    CashService,
    StatsService,
    TradingAdminService,
    TradingEventsService,
    TradingNotificationsService,
  ],
})
export class TradingModule {}
