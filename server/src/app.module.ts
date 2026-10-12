import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DeviceRegistryModule } from './modules/device-registry/device-registry.module';
import { DevicesModule } from './modules/devices/devices.module';
import { EarningsModule } from './modules/earnings/earnings.module';
import { HealthModule } from './modules/health/health.module';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SeedModule } from './modules/seed/seed.module';
import { SitesModule } from './modules/sites/sites.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { SharedModule } from './shared/shared.module';

/**
 * Module graph (every edge points down, so there are no cycles):
 *
 *   auth      -> users
 *   users     -> companies, devices, access
 *   devices   -> companies, sites, device-registry, earnings, access
 *   sites     -> companies, earnings, access
 *   companies -> earnings
 *   payments  -> devices, access
 *   wallet    -> payments
 *   mqtt      -> devices, payments, device-registry
 *   earnings / access / device-registry -> (nothing)
 *
 * `shared` is global and imports nothing by design.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    SharedModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),

    // Feature modules
    AuthModule,
    UsersModule,
    CompaniesModule,
    SitesModule,
    DevicesModule,
    DeviceRegistryModule,
    PaymentsModule,
    EarningsModule,
    WalletModule,
    AccessModule,
    MqttModule,
    HealthModule,
    SeedModule,
  ],
  providers: [
    // Auth is on by default; routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
