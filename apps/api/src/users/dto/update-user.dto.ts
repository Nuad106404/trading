import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole, UserStatus } from '../../common/enums/user-role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdateStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
