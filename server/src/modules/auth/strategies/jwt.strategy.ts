import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../../../config/configuration';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../../shared/interfaces/authenticated-user.interface';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<JwtConfig>('jwt').secret,
    });
  }

  /**
   * The DB is re-checked on every request: a deactivated account, or one
   * moved to another company, must lose access immediately rather than when
   * its token happens to expire.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') throw new UnauthorizedException('Not an access token');

    const user = await this.users.findById(payload.sub).catch(() => null);
    if (!user || !user.isActive) throw new UnauthorizedException('Account is inactive');

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      fullName: user.fullName,
    };
  }
}
