import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { EMULATOR_CONFIG, loadConfig } from './config';
import { DatabaseService } from './database/database.service';
import { DevicesController } from './devices/devices.controller';
import { DevicesRepository } from './devices/devices.repository';
import { DevicesService } from './devices/devices.service';
import { FrameLogService } from './devices/frame-log.service';
import { EventBusService } from './events/event-bus.service';
import { StreamController } from './events/stream.controller';
import { TerminalFleetService } from './runtime/terminal-fleet.service';

/** One small app; nothing here is imported from, or by, the platform. */
@Module({
  controllers: [AppController, AuthController, DevicesController, StreamController],
  providers: [
    // Read once: an unset password is generated here and must not change.
    { provide: EMULATOR_CONFIG, useFactory: loadConfig },
    { provide: APP_GUARD, useClass: AuthGuard },
    AuthService,
    DatabaseService,
    EventBusService,
    FrameLogService,
    DevicesRepository,
    TerminalFleetService,
    DevicesService,
  ],
})
export class AppModule {}
