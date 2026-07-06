import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TradingSource } from './trade.schema';

export enum CashType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export type CashTransactionDocument = HydratedDocument<CashTransaction>;

@Schema({
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  },
})
export class CashTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: CashType, required: true })
  type: CashType;

  // always stored positive; `type` carries the direction
  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ trim: true })
  note?: string;

  @Prop({ type: String, enum: TradingSource, default: TradingSource.MANUAL })
  source: TradingSource;

  createdAt: Date;
  updatedAt: Date;
}

export const CashTransactionSchema = SchemaFactory.createForClass(CashTransaction);

CashTransactionSchema.index({ userId: 1, date: -1 });

/** Signed delta for balance math: deposits add, withdrawals subtract. */
export const SIGNED_AMOUNT_EXPR = {
  $cond: [{ $eq: ['$type', CashType.DEPOSIT] }, '$amount', { $multiply: ['$amount', -1] }],
};
