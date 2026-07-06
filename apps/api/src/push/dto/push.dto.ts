import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class SubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class SubscribeDto {
  @IsUrl({ require_tld: false })
  endpoint: string;

  @ValidateNested()
  @Type(() => SubscriptionKeysDto)
  keys: SubscriptionKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string;
}

export class UnsubscribeDto {
  @IsUrl({ require_tld: false })
  endpoint: string;
}

export class BroadcastDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  /** 'all' | 'admins' | a specific user id */
  @IsString()
  @IsNotEmpty()
  target: string;
}

export class TestPushDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;
}
