import { Injectable, Logger } from '@nestjs/common';
import { DevicesService } from '../../devices/devices.service';
import { DeviceEventHandler, MqttInboundMessage } from '../interfaces/mqtt-message.interface';
import { PaymentStatusValue, VID } from '../protocol/terminal-protocol';
import { TerminalState } from '../terminal-state';

/**
 * VID 0x82: is the terminal idle or in the middle of a payment. Worth
 * checking before sending it a 0x50 set-amount.
 */
@Injectable()
export class TerminalStatusHandler implements DeviceEventHandler {
  readonly event = 'status';
  readonly vids = [VID.PAYMENT_STATUS];
  readonly name = 'terminal-status';
  private readonly logger = new Logger(TerminalStatusHandler.name);

  constructor(private readonly devices: DevicesService) {}

  async handle(message: MqttInboundMessage): Promise<void> {
    const device = await this.devices.findByUid(message.topic.deviceUid);
    if (!device) return;

    const value = message.frame.records?.find((r) => r.vid === VID.PAYMENT_STATUS)?.value;
    const status =
      value === PaymentStatusValue.IDLE
        ? 'idle'
        : value === PaymentStatusValue.BUSY
          ? 'busy'
          : null;
    if (status) {
      const state: TerminalState = {
        paymentStatus: status,
        paymentStatusAt: message.receivedAt.toISOString(),
      };
      await this.devices.patchTerminalState(device.id, state as Record<string, unknown>);
    } else {
      this.logger.warn(`Payment status ${value} from ${device.deviceUid} is neither idle nor busy`);
    }
    await this.devices.markSeen(device.id, message.receivedAt);
  }
}
