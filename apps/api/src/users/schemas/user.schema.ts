import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole, UserStatus } from '../../common/enums/user-role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  },
})
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // select: false — must be requested explicitly with .select('+passwordHash')
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ trim: true })
  fullName?: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER, index: true })
  role: UserRole;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE, index: true })
  status: UserStatus;

  // TRUE only for the seeded primary superadmin — immutable via API/UI
  @Prop({ default: false })
  isProtected: boolean;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
