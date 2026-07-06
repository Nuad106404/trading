import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum TradeSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum TradingSource {
  MANUAL = 'manual',
  IMPORT = 'import',
}

export type TradeDocument = HydratedDocument<Trade>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  },
})
export class Trade {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, trim: true, index: true })
  symbol: string;

  // broker position/order id (MT5 "Position" column) — used for import dedup
  @Prop({ trim: true })
  ticket?: string;

  @Prop({ type: String, enum: TradeSide, required: true })
  side: TradeSide;

  @Prop({ required: true, min: 0 })
  lots: number;

  @Prop()
  openPrice?: number;

  @Prop()
  closePrice?: number;

  @Prop()
  sl?: number;

  @Prop()
  tp?: number;

  @Prop({ type: Date })
  openTime?: Date;

  @Prop({ type: Date, index: true })
  closeTime?: Date;

  // usually negative
  @Prop({ default: 0 })
  commission: number;

  @Prop({ default: 0 })
  swap: number;

  // gross profit, before commission/swap
  @Prop({ required: true, default: 0 })
  profit: number;

  @Prop({ type: [String], default: undefined })
  tags?: string[];

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: String, enum: TradingSource, default: TradingSource.MANUAL })
  source: TradingSource;

  createdAt: Date;
  updatedAt: Date;
}

export const TradeSchema = SchemaFactory.createForClass(Trade);

// most common access pattern: one user's trades ordered by close time
TradeSchema.index({ userId: 1, closeTime: -1 });

// netProfit is derived, never stored — keep one source of truth
TradeSchema.virtual('netProfit').get(function (this: Trade) {
  return (this.profit ?? 0) + (this.commission ?? 0) + (this.swap ?? 0);
});

/** Same expression for aggregation pipelines. */
export const NET_PROFIT_EXPR = { $add: ['$profit', '$commission', '$swap'] };
