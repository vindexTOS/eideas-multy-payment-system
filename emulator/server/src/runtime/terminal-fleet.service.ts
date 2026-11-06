import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { EMULATOR_CONFIG, EmulatorConfig } from '../config';
import { DeviceRecord, DeviceView } from '../devices/device.types';
import { DevicesRepository } from '../devices/devices.repository';
import { FrameLogService } from '../devices/frame-log.service';
import { EventBusService } from '../events/event-bus.service';
import { VirtualTerminal } from './virtual-terminal';

/** Every virtual terminal in this process, by device id. */
@Injectable()
export class TerminalFleetService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TerminalFleetService.name);
  private readonly terminals = new Map<string, VirtualTerminal>();

  constructor(
    @Inject(EMULATOR_CONFIG) private readonly config: EmulatorConfig,
    private readonly devices: DevicesRepository,
    private readonly frames: FrameLogService,
    private readonly bus: EventBusService,
  ) {}

  /** Bring back what was running before the restart. */
  onApplicationBootstrap(): void {
    const all = this.devices.all();
    for (const device of all) {
      const terminal = this.add(device);
      if (device.autoConnect) terminal.connect();
    }
    const { url, port, rootTopic } = this.config.mqtt;
    this.logger.log(
      `${all.length} virtual terminal(s), ${all.filter((d) => d.autoConnect).length} connecting to ${url}:${port} (root "${rootTopic}")`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.terminals.values()].map((t) => t.disconnect()));
  }

  add(device: DeviceRecord): VirtualTerminal {
    const terminal: VirtualTerminal = new VirtualTerminal(device, this.config, {
      log: (entry) => this.frames.write(device.id, entry),
      changed: () => this.bus.emit({ type: 'device', device: this.view(terminal) }),
      persist: () => this.devices.update(terminal.device),
    });
    this.terminals.set(device.id, terminal);
    return terminal;
  }

  get(id: string): VirtualTerminal {
    const terminal = this.terminals.get(id);
    if (!terminal) throw new NotFoundException(`Device ${id} not found`);
    return terminal;
  }

  all(): VirtualTerminal[] {
    return [...this.terminals.values()].sort((a, b) =>
      b.device.createdAt.localeCompare(a.device.createdAt),
    );
  }

  async remove(id: string): Promise<void> {
    await this.get(id).disconnect();
    this.terminals.delete(id);
  }

  view(terminal: VirtualTerminal): DeviceView {
    return { ...terminal.device, runtime: { ...terminal.runtime } };
  }
}
