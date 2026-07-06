import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { UserRole } from '../common/enums/user-role.enum';
import { PushService } from '../push/push.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CashService } from './cash.service';
import {
  QueryCashDto,
  QueryTradesDto,
  UpdateCashDto,
  UpdateTradeDto,
} from './dto/trade.dto';
import { TradeDocument } from './schemas/trade.schema';
import { TradesService } from './trades.service';

/**
 * Admin management of other users' journals. Reuses the owner-scoped
 * services (so a tradeId/userId mismatch still 404s) and adds the same
 * role rule as user management: admins may only act on user-role targets,
 * superadmin on anyone.
 */
@Injectable()
export class TradingAdminService {
  private readonly logger = new Logger(TradingAdminService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly tradesService: TradesService,
    private readonly cashService: CashService,
    private readonly pushService: PushService,
  ) {}

  async listTrades(actor: UserDocument, targetUserId: string, query: QueryTradesDto) {
    await this.resolveTarget(actor, targetUserId);
    return this.tradesService.findAll(targetUserId, query);
  }

  async updateTrade(
    actor: UserDocument,
    targetUserId: string,
    tradeId: string,
    dto: UpdateTradeDto,
  ) {
    const target = await this.resolveTarget(actor, targetUserId);
    const trade = await this.tradesService.update(targetUserId, tradeId, dto);
    this.notifyOwner(actor, target, `updated a trade (${trade.symbol} ${trade.side} ${trade.lots} lots)`);
    return trade;
  }

  async deleteTrade(actor: UserDocument, targetUserId: string, tradeId: string) {
    const target = await this.resolveTarget(actor, targetUserId);
    const trade = await this.tradesService.findOne(targetUserId, tradeId);
    const result = await this.tradesService.remove(targetUserId, tradeId);
    this.notifyOwner(actor, target, `deleted a trade (${this.describe(trade)})`);
    return result;
  }

  async listCash(actor: UserDocument, targetUserId: string, query: QueryCashDto) {
    await this.resolveTarget(actor, targetUserId);
    return this.cashService.findAll(targetUserId, query);
  }

  async updateCash(actor: UserDocument, targetUserId: string, txId: string, dto: UpdateCashDto) {
    const target = await this.resolveTarget(actor, targetUserId);
    const tx = await this.cashService.update(targetUserId, txId, dto);
    this.notifyOwner(actor, target, `updated a ${tx.type} of $${tx.amount}`);
    return tx;
  }

  async deleteCash(actor: UserDocument, targetUserId: string, txId: string) {
    const target = await this.resolveTarget(actor, targetUserId);
    const result = await this.cashService.remove(targetUserId, txId);
    this.notifyOwner(actor, target, 'deleted a cash transaction');
    return result;
  }

  // ---------------------------------------------------------------- helpers

  private async resolveTarget(actor: UserDocument, targetUserId: string): Promise<UserDocument> {
    if (!isValidObjectId(targetUserId)) throw new NotFoundException('User not found.');
    const target = await this.userModel.findById(targetUserId).exec();
    if (!target) throw new NotFoundException('User not found.');
    if (actor.role === UserRole.ADMIN && target.role !== UserRole.USER) {
      throw new ForbiddenException('Admins can only manage user-role journals.');
    }
    return target;
  }

  private describe(trade: TradeDocument): string {
    return `${trade.symbol} ${trade.side} ${trade.lots} lots`;
  }

  /** Tell the journal owner an admin touched their data (skip self-edits). */
  private notifyOwner(actor: UserDocument, target: UserDocument, action: string): void {
    if (actor._id.toString() === target._id.toString()) return;
    this.pushService
      .sendToUser(target._id.toString(), {
        title: 'Journal changed by an administrator',
        body: `${actor.username} ${action} in your trading journal.`,
        url: '/trading/trades',
        tag: 'trading-admin-change',
      })
      .catch((err) => this.logger.warn(`Owner notify failed: ${err?.message}`));
  }
}
