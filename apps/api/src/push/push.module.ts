import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import {
  PushSubscription,
  PushSubscriptionSchema,
} from './schemas/push-subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PushSubscription.name, schema: PushSubscriptionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
