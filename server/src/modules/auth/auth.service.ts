import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { JwtConfig } from '../../config/configuration';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../shared/interfaces/authenticated-user.interface';
import { PasswordService } from '../../shared/services/password.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthProfileDto, AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.jwtConfig = config.getOrThrow<JwtConfig>('jwt');
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findByEmailWithSecret(dto.email);
    // One message for both branches: never reveal which emails exist.
    const invalid = new UnauthorizedException('Invalid email or password');
    if (!user) throw invalid;
    if (!(await this.passwords.compare(dto.password, user.passwordHash))) throw invalid;
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    await this.users.markLogin(user.id);
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Not a refresh token');

    const user = await this.users.findById(payload.sub);
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');
    return this.issueTokens(user);
  }

  async profile(current: AuthenticatedUser): Promise<AuthProfileDto> {
    const user = await this.users.findById(current.id);
    return this.toProfile(user);
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const base = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { ...base, type: 'access' },
        this.signOptions(this.jwtConfig.secret, this.jwtConfig.accessExpiresIn),
      ),
      this.jwt.signAsync(
        { ...base, type: 'refresh' },
        this.signOptions(this.jwtConfig.refreshSecret, this.jwtConfig.refreshExpiresIn),
      ),
    ]);

    return { accessToken, refreshToken, user: this.toProfile(user) };
  }

  /** Lifetimes come from env as strings ("1h", "30d"); jsonwebtoken types
   *  them as a narrow literal union, hence the one cast. */
  private signOptions(secret: string, expiresIn: string): JwtSignOptions {
    return { secret, expiresIn: expiresIn as JwtSignOptions['expiresIn'] };
  }

  private toProfile(user: User): AuthProfileDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
    };
  }
}
