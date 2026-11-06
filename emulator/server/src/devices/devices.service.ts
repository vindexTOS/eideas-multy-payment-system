import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { EMULATOR_CONFIG, EmulatorConfig } from '../config';
import { EventBusService } from '../events/event-bus.service';
import { TerminalFleetService } from '../runtime/terminal-fleet.service';
import {
  NothingPendingError,
  TerminalOfflineError,
  VirtualTerminal,
} from '../runtime/virtual-terminal';
import { DEFAULT_BEHAVIOUR, DeviceRecord, DeviceView, FrameEntry } from './device.types';
import { CreateDeviceDto, UpdateDeviceDto } from './devices.dto';
import { DevicesRepository } from './devices.repository';
import { FrameLogService } from './frame-log.service';

/**
 * A DTO instance carries every declared key, unsent ones as undefined (ES2022
 * class fields); merged as-is they would wipe the saved values.
 */
const sentOnly = <T extends object>(value: T | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(value ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;

@Injectable()
export class DevicesService {
  constructor(
    @Inject(EMULATOR_CONFIG) private readonly config: EmulatorConfig,
    private readonly devices: DevicesRepository,
    private readonly fleet: TerminalFleetService,
    private readonly frames: FrameLogService,
    private readonly bus: EventBusService,
  ) {}

  list(): DeviceView[] {
    return this.fleet.all().map((terminal) => this.fleet.view(terminal));
  }

  get(id: string): DeviceView {
    return this.fleet.view(this.fleet.get(id));
  }

  create(dto: CreateDeviceDto): DeviceView {
    const suffix = dto.uidSuffix ?? randomBytes(3).toString('hex').toUpperCase();
    const uid = `${this.config.uidPrefix}${suffix}`;
    if (this.devices.uidTaken(uid)) throw new ConflictException(`${uid} already exists`);

    const device: DeviceRecord = {
      id: randomUUID(),
      uid,
      name: dto.name.trim(),
      autoConnect: dto.autoConnect ?? true,
      behaviour: { ...DEFAULT_BEHAVIOUR },
      config: null,
      configReceivedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.devices.insert(device);
    const terminal = this.fleet.add(device);
    if (device.autoConnect) terminal.connect();
    return this.announce(terminal);
  }

  update(id: string, dto: UpdateDeviceDto): DeviceView {
    const terminal = this.fleet.get(id);
    const device: DeviceRecord = {
      ...terminal.device,
      name: dto.name?.trim() ?? terminal.device.name,
      behaviour: { ...terminal.device.behaviour, ...sentOnly(dto.behaviour) },
    };
    this.devices.update(device);
    terminal.update(device);
    return this.announce(terminal);
  }

  async remove(id: string): Promise<void> {
    await this.fleet.remove(id);
    this.devices.remove(id);
    this.bus.emit({ type: 'removed', deviceId: id });
  }

  /** Remembered: a connected terminal reconnects after an emulator restart. */
  connect(id: string): DeviceView {
    const terminal = this.fleet.get(id);
    this.setAutoConnect(terminal, true);
    terminal.connect();
    return this.announce(terminal);
  }

  async disconnect(id: string): Promise<DeviceView> {
    const terminal = this.fleet.get(id);
    this.setAutoConnect(terminal, false);
    await terminal.disconnect();
    return this.announce(terminal);
  }

  /** Run a terminal action, turning its failures into HTTP answers. */
  act(id: string, action: (terminal: VirtualTerminal) => void): DeviceView {
    const terminal = this.fleet.get(id);
    try {
      action(terminal);
    } catch (error) {
      const message = (error as Error).message;
      if (error instanceof TerminalOfflineError || error instanceof NothingPendingError) {
        throw new ConflictException(message);
      }
      // Anything else is the protocol refusing an out-of-spec frame.
      throw new BadRequestException(message);
    }
    return this.fleet.view(terminal);
  }

  frameLog(id: string, limit: number): FrameEntry[] {
    this.fleet.get(id);
    return this.frames.list(id, limit);
  }

  clearFrameLog(id: string): void {
    this.fleet.get(id);
    this.frames.clear(id);
  }

  private setAutoConnect(terminal: VirtualTerminal, autoConnect: boolean): void {
    terminal.device = { ...terminal.device, autoConnect };
    this.devices.update(terminal.device);
  }

  private announce(terminal: VirtualTerminal): DeviceView {
    const view = this.fleet.view(terminal);
    this.bus.emit({ type: 'device', device: view });
    return view;
  }
}
