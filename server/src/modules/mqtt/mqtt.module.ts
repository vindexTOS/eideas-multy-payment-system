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
import { TerminalOperationHandler } from './handlers/terminal-operation.handler';
import { TerminalStatusHandler } from './handlers/terminal-status.handler';
import { DEVICE_EVENT_HANDLERS } from './interfaces/mqtt-message.interface';
import { MqttController } from './mqtt.controller';
import { MqttRouterService } from './mqtt-router.service';
import { MqttService } from './mqtt.service';
import { PaymentFrameParser } from './payment-frame.parser';
import { TerminalCommandsService } from './terminal-commands.service';
import { TerminalController } from './terminal.controller';

/**
 * The listener. Adding a new device event = write a handler (claiming its
 * VIDs) and list it in `handlers` below; nothing else in the module changes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceMessage]),
    DevicesModule,
    PaymentsModule,
    DeviceRegistryModule,
  ],
  controllers: [MqttController, TerminalController],
  providers: [
    FrameCodec,
    PaymentFrameParser,
    DeviceMessageService,
    PaymentHandler,
    TerminalStatusHandler,
    TerminalOperationHandler,
    HeartbeatHandler,
    FallbackHandler,
    {
      provide: DEVICE_EVENT_HANDLERS,
      inject: [
        PaymentHandler,
        TerminalStatusHandler,
        TerminalOperationHandler,
        HeartbeatHandler,
        FallbackHandler,
      ],
      useFactory: (...handlers: object[]) => handlers,
    },
    MqttRouterService,
    MqttService,
    TerminalCommandsService,
  ],
  exports: [MqttService, MqttRouterService, TerminalCommandsService],
})
export class MqttModule {}
