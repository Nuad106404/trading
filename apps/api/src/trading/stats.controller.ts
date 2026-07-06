import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { StatsService } from './stats.service';

@Controller('trading')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // ------------------------------------------------ own stats (any role)

  @Get('stats/summary')
  summary(@CurrentUser() user: UserDocument) {
    return this.statsService.summary(user._id.toString());
  }

  @Get('stats/equity-curve')
  equityCurve(@CurrentUser() user: UserDocument) {
    return this.statsService.equityCurve(user._id.toString());
  }

  @Get('stats/monthly')
  monthly(@CurrentUser() user: UserDocument) {
    return this.statsService.monthly(user._id.toString());
  }

  @Get('stats/by-symbol')
  bySymbol(@CurrentUser() user: UserDocument) {
    return this.statsService.bySymbol(user._id.toString());
  }

  @Get('stats/max-drawdown')
  maxDrawdown(@CurrentUser() user: UserDocument) {
    return this.statsService.maxDrawdown(user._id.toString());
  }

  // -------------------------------------------------- admin oversight stats
  // (mutations on other users' journals live in TradingAdminController)

  @Get('admin/overview')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  adminOverview() {
    return this.statsService.adminOverview();
  }

  @Get('admin/users/:userId/summary')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  adminUserSummary(@Param('userId') userId: string) {
    if (!isValidObjectId(userId)) throw new NotFoundException('User not found.');
    return this.statsService.summary(userId);
  }

  @Get('admin/users/:userId/equity-curve')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  adminUserEquityCurve(@Param('userId') userId: string) {
    if (!isValidObjectId(userId)) throw new NotFoundException('User not found.');
    return this.statsService.equityCurve(userId);
  }
}
