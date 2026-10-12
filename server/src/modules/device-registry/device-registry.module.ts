import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceRegistryController } from './device-registry.controller';
import { DeviceRegistryService } from './device-registry.service';
import { UnregisteredDevice } from './entities/unregistered-device.entity';

/**
 * Standalone on purpose: both the MQTT listener (writes) and the devices
 * module (claims) use it, and it depends on neither.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UnregisteredDevice])],
  controllers: [DeviceRegistryController],
  providers: [DeviceRegistryService],
  exports: [DeviceRegistryService],
})
export class DeviceRegistryModule {}
