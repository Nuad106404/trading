import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PushSubscriptionDocument = HydratedDocument<PushSubscription>;

@Schema({ _id: false })
class SubscriptionKeys {
  @Prop({ required: true })
  p256dh: string;

  @Prop({ required: true })
  auth: string;
}

@Schema({ timestamps: true })
export class PushSubscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  endpoint: string;

  @Prop({ type: SubscriptionKeys, required: true })
  keys: SubscriptionKeys;

  @Prop()
  userAgent?: string;
}

export const PushSubscriptionSchema = SchemaFactory.createForClass(PushSubscription);
