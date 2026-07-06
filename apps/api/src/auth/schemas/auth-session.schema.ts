import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuthSessionDocument = HydratedDocument<AuthSession>;

/** One document per issued refresh token (hashed). Deleted on rotation/logout, expired by TTL index. */
@Schema({ timestamps: true })
export class AuthSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
