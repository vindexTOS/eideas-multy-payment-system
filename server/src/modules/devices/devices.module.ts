import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { CompaniesModule } from '../companies/companies.module';
import { DeviceRegistryModule } from '../device-registry/device-registry.module';
import { EarningsModule } from '../earnings/earnings.module';
import { SitesModule } from '../sites/sites.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Device } from './entities/device.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device]),
    CompaniesModule,
    SitesModule,
    DeviceRegistryModule,
    EarningsModule,
    AccessModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
