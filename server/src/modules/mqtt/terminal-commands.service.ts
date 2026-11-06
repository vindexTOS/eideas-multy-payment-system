import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Device } from '../devices/entities/device.entity';
import { DevicesService } from '../devices/devices.service';
import { OutboundRecord } from './frame.codec';
import { MqttService } from './mqtt.service';
import {
  CONFIG_DEFINITIONS,
  TerminalConfig,
  TerminalConfigKey,
  VID,
  effectiveConfig,
} from './protocol/terminal-protocol';

export interface TerminalConfigView {
  config: TerminalConfig;
  /** True while nothing was ever saved, i.e. the device runs on spec defaults. */
  isDefault: boolean;
  configSentAt: Date | null;
}

export interface ConfigPushResult extends TerminalConfigView {
  /** The broker accepted the frame. The protocol has no device ack. */
  delivered: boolean;
  topic: string | null;
  hex: string | null;
  error: string | null;
}

export interface CommandSent {
  topic: string;
  hex: string;
  sent: true;
}

/** Server -> terminal: configs (0x01-0x08) and commands (0x50, 0x51). */
@Injectable()
export class TerminalCommandsService {
  private readonly logger = new Logger(TerminalCommandsService.name);

  constructor(
    private readonly mqtt: MqttService,
    private readonly devices: DevicesService,
  ) {}

  describeConfig(device: Device): TerminalConfigView {
    return {
      config: effectiveConfig(device.config),
      isDefault: device.config === null,
      configSentAt: device.configSentAt,
    };
  }

  /**
   * Save, then push the WHOLE config, not just the changed keys: a full push
   * also repairs a terminal that missed an earlier one. A failed push keeps
   * the save, and says so, rather than failing the request.
   */
  async updateConfig(device: Device, changes: Partial<TerminalConfig>): Promise<ConfigPushResult> {
    // A DTO instance carries every declared key, unsent ones as undefined
    // (ES2022 class fields); spread as-is they would wipe the saved values.
    const sent = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
    const config = effectiveConfig({ ...device.config, ...sent });
    await this.devices.saveConfig(device.id, { ...config });
    return this.pushConfig({ ...device, config: { ...config } } as Device);
  }

  async pushConfig(device: Device): Promise<ConfigPushResult> {
    const config = effectiveConfig(device.config);
    const records: OutboundRecord[] = CONFIG_DEFINITIONS.map((d) => ({
      vid: d.vid,
      value: config[d.key as TerminalConfigKey],
    }));

    try {
      const { topic, hex } = await this.mqtt.publishRecords(device.deviceUid, records);
      const sentAt = new Date();
      await this.devices.markConfigSent(device.id, sentAt);
      this.logger.log(`Config sent to ${device.deviceUid}: ${hex}`);
      return {
        config,
        isDefault: device.config === null,
        configSentAt: sentAt,
        delivered: true,
        topic,
        hex,
        error: null,
      };
    } catch (error) {
      const reason = (error as Error).message;
      this.logger.warn(`Config for ${device.deviceUid} not sent: ${reason}`);
      return {
        ...this.describeConfig(device),
        delivered: false,
        topic: null,
        hex: null,
        error: reason,
      };
    }
  }

  setAmount(device: Device, amountTetri: number): Promise<CommandSent> {
    return this.send(device, [{ vid: VID.SET_AMOUNT, value: amountTetri }]);
  }

  reconcile(device: Device): Promise<CommandSent> {
    return this.send(device, [{ vid: VID.RECONCILE }]);
  }

  private async send(device: Device, records: OutboundRecord[]): Promise<CommandSent> {
    try {
      const { topic, hex } = await this.mqtt.publishRecords(device.deviceUid, records);
      this.logger.log(`Command sent to ${device.deviceUid}: ${hex}`);
      return { topic, hex, sent: true };
    } catch (error) {
      throw new ServiceUnavailableException(
        `Command not sent to ${device.deviceUid}: ${(error as Error).message}`,
      );
    }
  }
}
