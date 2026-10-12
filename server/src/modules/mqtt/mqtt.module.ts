import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceRegistryModule } from '../device-registry/device-registry.module';
import { DevicesModule } from '../devices/devices.module';
import { PaymentsModule } from '../payments/payments.module';
import { DeviceMessageService } from './device-message.service';
import { DeviceMessage } from './entities/device-message.entity';
import { FrameCodec } from './frame.codec';
import { FallbackHandler } from './handlers/fallback.handler';
import { HeartbeatHandler } from './handlers/heartbeat.handler';
import { PaymentHandler } from './handlers/payment.handler';
import { DEVICE_EVENT_HANDLERS } from './interfaces/mqtt-message.interface';
import { MqttController } from './mqtt.controller';
import { MqttRouterService } from './mqtt-router.service';
import { MqttService } from './mqtt.service';
import { PaymentFrameParser } from './payment-frame.parser';

/**
 * The listener. Adding a new device event = write a handler and list it in
 * `handlers` below; nothing else in the module changes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceMessage]),
    DevicesModule,
    PaymentsModule,
    DeviceRegistryModule,
  ],
  controllers: [MqttController],
  providers: [
    FrameCodec,
    PaymentFrameParser,
    DeviceMessageService,
    PaymentHandler,
    HeartbeatHandler,
    FallbackHandler,
    {
      provide: DEVICE_EVENT_HANDLERS,
      inject: [PaymentHandler, HeartbeatHandler, FallbackHandler],
      useFactory: (...handlers: object[]) => handlers,
    },
    MqttRouterService,
    MqttService,
  ],
  exports: [MqttService, MqttRouterService],
})
export class MqttModule {}
