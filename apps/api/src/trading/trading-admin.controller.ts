import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserDocument } from '../users/schemas/user.schema';
import {
  BulkIdsDto,
  QueryCashDto,
  QueryTradesDto,
  UpdateCashDto,
  UpdateTradeDto,
} from './dto/trade.dto';
import { TradingAdminService } from './trading-admin.service';

@Controller('trading/admin/users/:userId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
export class TradingAdminController {
  constructor(private readonly adminService: TradingAdminService) {}

  @Get('trades')
  listTrades(
    @CurrentUser() actor: UserDocument,
    @Param('userId') userId: string,
    @Query() query: QueryTradesDto,
  ) {
    return this.adminService.listTrades(actor, userId, query);
  }

  @Patch('trades/:tradeId')
  updateTrade(
    @CurrentUser() actor: UserDocument,
    @Param('userId') userId: string,
    @Param('tradeId') tradeId: string,
    @Body() dto: UpdateTradeDto,
  ) {
    return this.adminService.updateTrade(actor, userId, tradeId, dto);
  }

  @Delete('trades/:tradeId')
  deleteTrade(
    @CurrentUser() actor: UserDocument,
    @Param('userId') userId: string,
    @Param('tradeId') tradeId: string,
  ) {
    return this.adminService.deleteTrade(actor, userId, tradeId);
  }

  @Post('trades/bulk-delete')
  bulkDeleteTrades(
    @CurrentUser() actor: UserDocument,
    @Param('userId') userId: string,
    @Body() dto: BulkIdsDto,
  ) {
    return this.adminService.bulkDeleteTrades(actor, userId, dto.ids);
  }

  @Get('cash')
  listCash(
    @CurrentUser() actor: UserDocument,
    @Param('userId') userId: string,
    @Query() query: QueryCashDto,
  ) {
    return this.adminService.listCash(actor, userId, query);
  }

  @Patch('cash/:txId')
  updateCash(
    @CurrentUser() actor: UserDocument,
    @Param('userId') userId: string,
    @Param('txId') txId: string,
    @Body() dto: UpdateCashDto,
  ) {
    return this.adminService.updateCash(actor, userId, txId, dto);
  }

  @Delete('cash/:txId')
  deleteCash(
    @CurrentUser() actor: UserDocument,
    @Param('userId') userId: string,
    @Param('txId') txId: string,
  ) {
    return this.adminService.deleteCash(actor, userId, txId);
  }
}
