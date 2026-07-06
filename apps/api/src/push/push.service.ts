import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as webpush from 'web-push';
import { UserRole } from '../common/enums/user-role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SubscribeDto } from './dto/push.dto';
import {
  PushSubscription,
  PushSubscriptionDocument,
} from './schemas/push-subscription.schema';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private configured = false;

  constructor(
    @InjectModel(PushSubscription.name)
    private readonly subscriptionModel: Model<PushSubscriptionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('vapid.publicKey');
    const privateKey = this.config.get<string>('vapid.privateKey');
    const subject = this.config.get<string>('vapid.subject', 'mailto:admin@local.host');
    if (publicKey && privateKey && !publicKey.startsWith('your_')) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
    } else {
      this.logger.warn(
        'VAPID keys not configured — web push disabled. Generate with: npx web-push generate-vapid-keys',
      );
    }
  }

  getPublicKey(): { publicKey: string } {
    return { publicKey: this.config.get<string>('vapid.publicKey', '') };
  }

  async subscribe(userId: string, dto: SubscribeDto, userAgent?: string) {
    await this.subscriptionModel
      .findOneAndUpdate(
        { endpoint: dto.endpoint },
        {
          userId: new Types.ObjectId(userId),
          endpoint: dto.endpoint,
          keys: dto.keys,
          userAgent: dto.userAgent ?? userAgent,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
    return { success: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.subscriptionModel
      .deleteOne({ endpoint, userId: new Types.ObjectId(userId) })
      .exec();
    return { success: true };
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    const subs = await this.subscriptionModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();
    return this.sendToSubscriptions(subs, payload);
  }

  async sendToRoles(roles: UserRole[], payload: PushPayload): Promise<number> {
    const users = await this.userModel.find({ role: { $in: roles } }).select('_id').exec();
    const subs = await this.subscriptionModel
      .find({ userId: { $in: users.map((u) => u._id) } })
      .exec();
    return this.sendToSubscriptions(subs, payload);
  }

  async sendToAll(payload: PushPayload): Promise<number> {
    const subs = await this.subscriptionModel.find().exec();
    return this.sendToSubscriptions(subs, payload);
  }

  /**
   * Sends to every subscription; stale endpoints (404/410) are removed,
   * other failures are logged and swallowed so one bad endpoint never
   * breaks a broadcast.
   */
  private async sendToSubscriptions(
    subs: PushSubscriptionDocument[],
    payload: PushPayload,
  ): Promise<number> {
    if (!this.configured || subs.length === 0) return 0;

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          body,
        ),
      ),
    );

    let delivered = 0;
    await Promise.allSettled(
      results.map(async (result, i) => {
        if (result.status === 'fulfilled') {
          delivered++;
          return;
        }
        const statusCode = (result.reason as webpush.WebPushError)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await this.subscriptionModel.deleteOne({ _id: subs[i]._id }).exec();
          this.logger.log(`Removed stale push subscription (${statusCode}).`);
        } else {
          this.logger.warn(`Push send failed (${statusCode ?? 'network'}): ${result.reason?.message}`);
        }
      }),
    );
    return delivered;
  }
}
