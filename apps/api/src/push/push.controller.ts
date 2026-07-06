import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { BroadcastDto, SubscribeDto, TestPushDto, UnsubscribeDto } from './dto/push.dto';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  vapidPublicKey() {
    return this.pushService.getPublicKey();
  }

  @Post('subscribe')
  subscribe(
    @CurrentUser() user: UserDocument,
    @Body() dto: SubscribeDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.pushService.subscribe(user._id.toString(), dto, userAgent);
  }

  @Delete('subscribe')
  unsubscribe(@CurrentUser() user: UserDocument, @Body() dto: UnsubscribeDto) {
    return this.pushService.unsubscribe(user._id.toString(), dto.endpoint);
  }

  @Post('test')
  @HttpCode(200)
  async test(@CurrentUser() user: UserDocument, @Body() dto: TestPushDto) {
    const delivered = await this.pushService.sendToUser(user._id.toString(), {
      title: dto.title ?? 'Test notification',
      body: dto.body ?? `Hi ${user.username}, push notifications are working!`,
      url: '/profile',
      tag: 'push-test',
    });
    return { delivered };
  }

  @Post('broadcast')
  @HttpCode(200)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  async broadcast(@Body() dto: BroadcastDto) {
    const payload = { title: dto.title, body: dto.body, url: dto.url ?? '/' };
    let delivered: number;
    if (dto.target === 'all') {
      delivered = await this.pushService.sendToAll(payload);
    } else if (dto.target === 'admins') {
      delivered = await this.pushService.sendToRoles(
        [UserRole.SUPERADMIN, UserRole.ADMIN],
        payload,
      );
    } else if (isValidObjectId(dto.target)) {
      delivered = await this.pushService.sendToUser(dto.target, payload);
    } else {
      throw new BadRequestException("target must be 'all', 'admins' or a valid user id");
    }
    return { delivered };
  }
}
