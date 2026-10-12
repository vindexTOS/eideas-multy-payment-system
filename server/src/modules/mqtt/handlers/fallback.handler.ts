import { Injectable, Logger } from '@nestjs/common';
import { DevicesService } from '../../devices/devices.service';
import { DeviceEventHandler, MqttInboundMessage } from '../interfaces/mqtt-message.interface';

/**
 * Catch-all for events we have no handler for yet (the device spec is still
 * open). It keeps `lastSeenAt` fresh and relies on the router having already
 * stored the raw frame.
 */
@Injectable()
export class FallbackHandler implements DeviceEventHandler {
  readonly event = '*';
  readonly name = 'fallback';
  private readonly logger = new Logger(FallbackHandler.name);

  constructor(private readonly devices: DevicesService) {}

  async handle(message: MqttInboundMessage): Promise<void> {
    const device = await this.devices.findByUid(message.topic.deviceUid);
    if (device) await this.devices.markSeen(device.id, message.receivedAt);
    this.logger.debug(
      `Unhandled event "${message.topic.event}" from ${message.topic.deviceUid} (${message.frame.hex.slice(0, 48)})`,
    );
  }
}
