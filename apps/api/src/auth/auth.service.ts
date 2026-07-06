import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { UserStatus } from '../common/enums/user-role.enum';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthSession, AuthSessionDocument } from './schemas/auth-session.schema';

const INVALID_CREDENTIALS = 'Invalid credentials.'; // never reveal which field was wrong

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(AuthSession.name)
    private readonly sessionModel: Model<AuthSessionDocument>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.register(dto);
    const tokens = await this.issueTokens(user);
    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsernameOrEmailWithHash(dto.usernameOrEmail);
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException(INVALID_CREDENTIALS);

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended.');
    }

    await this.usersService.updateLastLogin(user._id.toString());
    user.lastLoginAt = new Date();

    const tokens = await this.issueTokens(user);
    return { user, ...tokens };
  }

  /** Rotation: the presented refresh token is consumed (deleted) and a new pair is issued. */
  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const session = await this.sessionModel
      .findOneAndDelete({ tokenHash: sha256(refreshToken) })
      .exec();
    if (!session) throw new UnauthorizedException('Refresh token has been revoked.');

    const user = await this.usersService.findById(payload.sub).catch(() => null);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is no longer active.');
    }

    const tokens = await this.issueTokens(user);
    return { user, ...tokens };
  }

  async logout(refreshToken: string) {
    await this.sessionModel.deleteOne({ tokenHash: sha256(refreshToken) }).exec();
    return { success: true };
  }

  async changePassword(user: UserDocument, currentPassword: string, newPassword: string) {
    const result = await this.usersService.changeOwnPassword(
      user._id.toString(),
      currentPassword,
      newPassword,
    );
    // revoke every other session so a stolen refresh token dies with the old password
    await this.sessionModel.deleteMany({ userId: user._id }).exec();
    return result;
  }

  private async issueTokens(user: UserDocument) {
    const accessToken = this.jwtService.sign(
      { sub: user._id.toString(), username: user.username, role: user.role },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get('jwt.accessTtl', '15m') as JwtSignOptions['expiresIn'],
      },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user._id.toString(), jti: randomUUID() },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshTtl', '7d') as JwtSignOptions['expiresIn'],
      },
    );

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);
    await this.sessionModel.create({
      userId: user._id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    });

    return { accessToken, refreshToken };
  }
}
