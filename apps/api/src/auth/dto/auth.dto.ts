import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const PASSWORD_MESSAGE = 'password must contain at least one letter and one number';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_.-]+$/, {
    message: 'username may only contain letters, numbers, dots, dashes and underscores',
  })
  username: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  usernameOrEmail: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
