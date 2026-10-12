import { Injectable, Logger } from '@nestjs/common';
import { DevicesService } from '../../devices/devices.service';
import { DeviceEventHandler, MqttInboundMessage } from '../interfaces/mqtt-message.interface';

/** Keeps `device.lastSeenAt` fresh so the UI can show online/offline. */
@Injectable()
export class HeartbeatHandler implements DeviceEventHandler {
  readonly event = 'heartbeat';
  readonly name = 'heartbeat';
  private readonly logger = new Logger(HeartbeatHandler.name);

  constructor(private readonly devices: DevicesService) {}

  async handle(message: MqttInboundMessage): Promise<void> {
    const device = await this.devices.findByUid(message.topic.deviceUid);
    if (!device) {
      // Unknown ids are already parked in the unregistered pool by the router.
      this.logger.debug(`Heartbeat from unregistered device ${message.topic.deviceUid}`);
      return;
    }
    await this.devices.markSeen(device.id, message.receivedAt);
  }
}
