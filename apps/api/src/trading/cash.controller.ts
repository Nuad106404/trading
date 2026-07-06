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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { CashService } from './cash.service';
import { BulkIdsDto, CreateCashDto, QueryCashDto, UpdateCashDto } from './dto/trade.dto';

@Controller('trading/cash')
@UseGuards(JwtAuthGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get()
  findAll(@CurrentUser() user: UserDocument, @Query() query: QueryCashDto) {
    return this.cashService.findAll(user._id.toString(), query);
  }

  @Post()
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateCashDto) {
    return this.cashService.create(user._id.toString(), dto);
  }

  @Post('bulk-delete')
  bulkDelete(@CurrentUser() user: UserDocument, @Body() dto: BulkIdsDto) {
    return this.cashService.bulkRemove(user._id.toString(), dto.ids);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateCashDto,
  ) {
    return this.cashService.update(user._id.toString(), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.cashService.remove(user._id.toString(), id);
  }
}
