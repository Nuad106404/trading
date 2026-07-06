import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TradeSide } from '../schemas/trade.schema';
import { CashType } from '../schemas/cash-transaction.schema';

export class CreateTradeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  symbol: string;

  @IsEnum(TradeSide)
  side: TradeSide;

  @IsNumber()
  @Min(0)
  lots: number;

  @IsOptional()
  @IsNumber()
  openPrice?: number;

  @IsOptional()
  @IsNumber()
  closePrice?: number;

  @IsOptional()
  @IsNumber()
  sl?: number;

  @IsOptional()
  @IsNumber()
  tp?: number;

  @IsOptional()
  @IsDateString()
  openTime?: string;

  @IsOptional()
  @IsDateString()
  closeTime?: string;

  @IsOptional()
  @IsNumber()
  commission?: number;

  @IsOptional()
  @IsNumber()
  swap?: number;

  // gross profit; when omitted it is derived from prices (see computeGrossProfit)
  @IsOptional()
  @IsNumber()
  profit?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateTradeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  symbol?: string;

  @IsOptional()
  @IsEnum(TradeSide)
  side?: TradeSide;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lots?: number;

  @IsOptional()
  @IsNumber()
  openPrice?: number;

  @IsOptional()
  @IsNumber()
  closePrice?: number;

  @IsOptional()
  @IsNumber()
  sl?: number;

  @IsOptional()
  @IsNumber()
  tp?: number;

  @IsOptional()
  @IsDateString()
  openTime?: string;

  @IsOptional()
  @IsDateString()
  closeTime?: string;

  @IsOptional()
  @IsNumber()
  commission?: number;

  @IsOptional()
  @IsNumber()
  swap?: number;

  @IsOptional()
  @IsNumber()
  profit?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class QueryTradesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 20;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  symbol?: string;

  @IsOptional()
  @IsEnum(TradeSide)
  side?: TradeSide;

  /** win: netProfit > 0, loss: netProfit <= 0 */
  @IsOptional()
  @IsIn(['win', 'loss'])
  result?: 'win' | 'loss';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['symbol', 'side', 'lots', 'profit', 'openTime', 'closeTime', 'createdAt'])
  sortBy: string = 'closeTime';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class CreateCashDto {
  @IsEnum(CashType)
  type: CashType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateCashDto {
  @IsOptional()
  @IsEnum(CashType)
  type?: CashType;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class QueryCashDto {
  @IsOptional()
  @IsEnum(CashType)
  type?: CashType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class BulkImportDto {
  @IsArray()
  @ArrayMaxSize(10_000)
  @ValidateNested({ each: true })
  @Type(() => CreateTradeDto)
  trades: CreateTradeDto[];

  @IsArray()
  @ArrayMaxSize(1_000)
  @ValidateNested({ each: true })
  @Type(() => CreateCashDto)
  transactions: CreateCashDto[];
}
