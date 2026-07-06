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
import {
  BulkIdsDto,
  BulkImportDto,
  CreateTradeDto,
  QueryTradesDto,
  UpdateTradeDto,
} from './dto/trade.dto';
import { TradesService } from './trades.service';

@Controller('trading/trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  findAll(@CurrentUser() user: UserDocument, @Query() query: QueryTradesDto) {
    return this.tradesService.findAll(user._id.toString(), query);
  }

  @Post()
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateTradeDto) {
    return this.tradesService.create(user._id.toString(), dto);
  }

  @Post('bulk-import')
  bulkImport(@CurrentUser() user: UserDocument, @Body() dto: BulkImportDto) {
    return this.tradesService.bulkImport(user._id.toString(), dto);
  }

  @Post('bulk-delete')
  bulkDelete(@CurrentUser() user: UserDocument, @Body() dto: BulkIdsDto) {
    return this.tradesService.bulkRemove(user._id.toString(), dto.ids);
  }

  @Get(':id')
  findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.tradesService.findOne(user._id.toString(), id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateTradeDto,
  ) {
    return this.tradesService.update(user._id.toString(), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.tradesService.remove(user._id.toString(), id);
  }
}
