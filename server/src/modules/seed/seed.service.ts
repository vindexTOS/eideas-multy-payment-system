import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeedConfig } from '../../config/configuration';
import { UserRole } from '../../shared/enums/user-role.enum';
import { PasswordService } from '../../shared/services/password.service';
import { User } from '../users/entities/user.entity';

/**
 * Creates the first admin so a fresh database is usable. Idempotent: if any
 * admin already exists it does nothing, and it never touches an existing
 * account password.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);
  private readonly config: SeedConfig;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<SeedConfig>('seed');
  }

  async onApplicationBootstrap(): Promise<void> {
    const admins = await this.users.countBy({ role: UserRole.ADMIN });
    if (admins > 0) return;

    const user = this.users.create({
      email: this.config.adminEmail.toLowerCase(),
      passwordHash: await this.passwords.hash(this.config.adminPassword),
      fullName: this.config.adminName,
      role: UserRole.ADMIN,
      companyId: null,
      isActive: true,
    });
    await this.users.save(user);

    // Printed once, and only on the boot that actually created the account.
    const shown = process.env.SEED_ADMIN_PASSWORD
      ? 'the configured SEED_ADMIN_PASSWORD'
      : `a generated password: ${this.config.adminPassword}`;
    this.logger.warn(`Seeded first admin ${user.email} with ${shown}`);
    this.logger.warn('Sign in and change this password before going live.');
  }
}
