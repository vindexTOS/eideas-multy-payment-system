import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { EMULATOR_CONFIG, EmulatorConfig } from '../config';
import { DatabaseService } from '../database/database.service';

export const SUPER_ADMIN_ROLE = 'super_admin';

export interface Session {
  sub: string;
  email: string;
  role: typeof SUPER_ADMIN_ROLE;
}

const PASSWORD_HASH = 'super_admin_password_scrypt';
const JWT_SECRET = 'jwt_secret';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();
const scrypt = (password: string, salt: Buffer): Buffer => scryptSync(password, salt, 32);

/**
 * The emulator has exactly one account: the super admin. It shares nothing
 * with the platform's users - a platform admin cannot sign in here, and this
 * account cannot sign in there.
 *
 * The password comes from EMULATOR_SUPER_ADMIN_PASSWORD when set (always
 * wins). Otherwise one is generated on first boot, printed once, and kept as
 * a scrypt hash in the emulator's own database, so it survives restarts and
 * `docker compose up` works with no .env at all. The session secret is kept
 * the same way, so a restart does not sign anyone out.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwt: JwtService;
  private readonly passwordMatches: (password: string) => boolean;

  constructor(
    @Inject(EMULATOR_CONFIG) private readonly config: EmulatorConfig,
    database: DatabaseService,
  ) {
    this.passwordMatches = this.resolvePassword(database);
    this.jwt = new JwtService({
      secret: config.jwt.secret ?? this.storedSecret(database),
      // '12h' style strings; the typings only spell out the ms() literals.
      signOptions: { expiresIn: config.jwt.expiresIn as JwtSignOptions['expiresIn'] },
    });
  }

  async login(email: string, password: string): Promise<{ accessToken: string; email: string }> {
    const { superAdmin } = this.config;
    // Hash first so the comparison is constant-time and length-independent.
    const emailOk = timingSafeEqual(digest(email.trim().toLowerCase()), digest(superAdmin.email));
    const passwordOk = this.passwordMatches(password);
    if (!emailOk || !passwordOk) {
      // A flat delay makes guessing slow without a rate-limit store.
      await new Promise((resolve) => setTimeout(resolve, 600));
      throw new UnauthorizedException('Wrong email or password');
    }
    const session: Session = {
      sub: 'super-admin',
      email: superAdmin.email,
      role: SUPER_ADMIN_ROLE,
    };
    return { accessToken: await this.jwt.signAsync(session), email: superAdmin.email };
  }

  async verify(token: string): Promise<Session> {
    try {
      const session = await this.jwt.verifyAsync<Session>(token);
      if (session.role !== SUPER_ADMIN_ROLE) throw new Error('not a super admin');
      return session;
    } catch {
      throw new UnauthorizedException('Session expired or invalid; sign in again');
    }
  }

  private resolvePassword(database: DatabaseService): (password: string) => boolean {
    const fromEnv = this.config.superAdmin.password;
    if (fromEnv) {
      const expected = digest(fromEnv);
      return (password) => timingSafeEqual(digest(password), expected);
    }

    let stored = database.setting(PASSWORD_HASH);
    if (!stored) {
      const password = randomBytes(12).toString('base64url');
      const salt = randomBytes(16);
      stored = `${salt.toString('hex')}:${scrypt(password, salt).toString('hex')}`;
      database.saveSetting(PASSWORD_HASH, stored);
      this.logger.warn(
        `Generated the super admin login - shown ONCE, keep it: ${this.config.superAdmin.email} / ${password}` +
          ' (set EMULATOR_SUPER_ADMIN_PASSWORD to choose your own; it always wins)',
      );
    } else {
      this.logger.log(
        `Super admin ${this.config.superAdmin.email} uses the password generated on first boot`,
      );
    }

    const [saltHex, hashHex] = stored.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    return (password) => timingSafeEqual(scrypt(password, salt), expected);
  }

  private storedSecret(database: DatabaseService): string {
    const existing = database.setting(JWT_SECRET);
    if (existing) return existing;
    const secret = randomBytes(32).toString('hex');
    database.saveSetting(JWT_SECRET, secret);
    return secret;
  }
}
