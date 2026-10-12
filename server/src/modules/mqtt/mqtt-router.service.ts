import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttConfig } from '../../config/configuration';
import { DeviceRegistryService } from '../device-registry/device-registry.service';
import { DevicesService } from '../devices/devices.service';
import { DeviceMessageService } from './device-message.service';
import { FrameCodec } from './frame.codec';
import {
  DEVICE_EVENT_HANDLERS,
  DeviceEventHandler,
  MqttInboundMessage,
} from './interfaces/mqtt-message.interface';
import { parseTopic } from './mqtt-topic.util';

export interface RouterStats {
  received: number;
  handled: number;
  failed: number;
  unknownDevices: number;
  lastMessageAt: Date | null;
}

/**
 * Decode -> identify -> audit -> dispatch.
 *
 * Separated from the transport (`MqttService`) on purpose: this class has no
 * idea a broker exists, which is what makes the simulate endpoint and unit
 * tests possible without a broker.
 */
@Injectable()
export class MqttRouterService {
  private readonly logger = new Logger(MqttRouterService.name);
  private readonly config: MqttConfig;
  private readonly byEvent = new Map<string, DeviceEventHandler>();
  private readonly stats: RouterStats = {
    received: 0,
    handled: 0,
    failed: 0,
    unknownDevices: 0,
    lastMessageAt: null,
  };

  constructor(
    config: ConfigService,
    private readonly codec: FrameCodec,
    private readonly messages: DeviceMessageService,
    private readonly registry: DeviceRegistryService,
    private readonly devices: DevicesService,
    @Inject(DEVICE_EVENT_HANDLERS) handlers: DeviceEventHandler[],
  ) {
    this.config = config.getOrThrow<MqttConfig>('mqtt');
    for (const handler of handlers) {
      this.byEvent.set(handler.event, handler);
    }
    this.logger.log(`Registered event handlers: ${[...this.byEvent.keys()].join(', ')}`);
  }

  getStats(): RouterStats {
    return { ...this.stats };
  }

  /** Entry point for every inbound frame, from the broker or the simulator. */
  async dispatch(rawTopic: string, buffer: Buffer, receivedAt = new Date()): Promise<void> {
    this.stats.received += 1;
    this.stats.lastMessageAt = receivedAt;

    const topic = parseTopic(rawTopic);
    const frame = this.codec.decode(buffer);
    const message: MqttInboundMessage = { topic, frame, receivedAt };

    if (!topic.deviceUid) {
      await this.messages.log(message, { error: 'Topic carries no device uid' });
      this.stats.failed += 1;
      return;
    }

    // Any traffic from an unknown id puts it in the pick list for the
    // create-device form. This is how onboarding stays self-service.
    const known = await this.devices.findByUid(topic.deviceUid);
    if (!known) {
      this.stats.unknownDevices += 1;
      await this.registry.touch({
        deviceUid: topic.deviceUid,
        topic: topic.raw,
        payload: frame.json ?? { hex: frame.hex, command: frame.command },
        seenAt: receivedAt,
      });
    }

    const handler = this.byEvent.get(topic.event) ?? this.byEvent.get('*');
    if (!handler) {
      await this.messages.log(message, { error: `No handler for event "${topic.event}"` });
      this.stats.failed += 1;
      return;
    }

    try {
      await handler.handle(message);
      this.stats.handled += 1;
      if (this.config.logRawMessages) {
        await this.messages.log(message, { handledBy: handler.name });
      }
    } catch (error) {
      this.stats.failed += 1;
      const reason = (error as Error).message;
      this.logger.error(`Handler ${handler.name} failed on ${topic.raw}: ${reason}`);
      // Always persisted on failure, whatever the log setting says - this is
      // the only record of money we could not book.
      await this.messages.log(message, { handledBy: handler.name, error: reason });
    }
  }
}
