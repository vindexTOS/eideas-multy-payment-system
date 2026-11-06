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
import { hexVid } from './protocol/terminal-protocol';

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
 * Terminal-protocol frames are dispatched by VID, whatever topic they came
 * in on: every handler claiming a VID in the frame runs once, in order, and
 * sees the whole frame (so the payment handler gets 0x80 with its 0x81).
 * JSON frames are dispatched by the topic's event segment, as before.
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
  private readonly byVid = new Map<number, DeviceEventHandler>();
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
      for (const vid of handler.vids ?? []) this.byVid.set(vid, handler);
    }
    const vids = [...this.byVid].map(([vid, h]) => `${hexVid(vid)}->${h.name}`).join(', ');
    this.logger.log(
      `Registered event handlers: ${[...this.byEvent.keys()].join(', ')}; VIDs: ${vids}`,
    );
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

    const handlers = this.handlersFor(message);
    if (!handlers.length) {
      await this.messages.log(message, { error: `No handler for event "${topic.event}"` });
      this.stats.failed += 1;
      return;
    }

    // Handlers claim different VIDs, so one failing must not stop the rest:
    // a bad status byte cannot be allowed to cost the payment beside it.
    const handledBy = handlers.map((h) => h.name).join('+');
    const errors: string[] = [];
    for (const handler of handlers) {
      try {
        await handler.handle(message);
      } catch (error) {
        const reason = (error as Error).message;
        this.logger.error(`Handler ${handler.name} failed on ${topic.raw}: ${reason}`);
        errors.push(handlers.length > 1 ? `${handler.name}: ${reason}` : reason);
      }
    }

    if (errors.length) {
      this.stats.failed += 1;
      // Always persisted on failure, whatever the log setting says - this is
      // the only record of money we could not book.
      await this.messages.log(message, { handledBy, error: errors.join('; ') });
      return;
    }

    this.stats.handled += 1;
    // A frame that looked like VID records but did not decode is kept
    // whatever the log setting says, for the same reason.
    if (this.config.logRawMessages || frame.protocolError) {
      await this.messages.log(message, { handledBy, error: frame.protocolError });
    }
  }

  private handlersFor({ topic, frame }: MqttInboundMessage): DeviceEventHandler[] {
    if (frame.records) {
      const claimed = new Set<DeviceEventHandler>();
      for (const record of frame.records) {
        const handler = this.byVid.get(record.vid);
        if (handler) claimed.add(handler);
      }
      if (claimed.size) return [...claimed];
    } else {
      const handler = this.byEvent.get(topic.event);
      if (handler) return [handler];
    }
    const fallback = this.byEvent.get('*');
    return fallback ? [fallback] : [];
  }
}
