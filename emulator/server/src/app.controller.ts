import { Controller, Get, Inject } from '@nestjs/common';
import { EMULATOR_CONFIG, EmulatorConfig } from './config';
import { Public } from './auth/public.decorator';
import {
  OPERATION_MODE_LABELS,
  OPERATION_VIDS,
  RESULT_LABELS,
  VID_DEFINITIONS,
} from './protocol/terminal-protocol';
import { TerminalFleetService } from './runtime/terminal-fleet.service';

@Controller()
export class AppController {
  constructor(
    @Inject(EMULATOR_CONFIG) private readonly config: EmulatorConfig,
    private readonly fleet: TerminalFleetService,
  ) {}

  @Public()
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Where the terminals are pointed - shown in the header so nobody tests against production by accident. */
  @Get('info')
  info() {
    const { url, port, rootTopic } = this.config.mqtt;
    const terminals = this.fleet.all();
    return {
      broker: `${url}:${port}`,
      rootTopic,
      uidPrefix: this.config.uidPrefix,
      superAdmin: this.config.superAdmin.email,
      devices: terminals.length,
      connected: terminals.filter((t) => t.runtime.connected).length,
    };
  }

  /** The protocol as the emulator implements it; the UI builds its forms from this. */
  @Get('protocol')
  protocol() {
    return {
      vids: VID_DEFINITIONS,
      results: RESULT_LABELS,
      operationModes: OPERATION_MODE_LABELS,
      operationVids: OPERATION_VIDS,
    };
  }
}
