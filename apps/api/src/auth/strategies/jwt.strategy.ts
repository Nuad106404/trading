import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '../../common/enums/user-role.enum';
import { UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret', 'change_me_access'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<UserDocument> {
    let user: UserDocument;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid token.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is suspended.');
    }
    return user;
  }
}
