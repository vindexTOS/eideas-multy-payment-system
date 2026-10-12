import { Injectable, Logger } from '@nestjs/common';
import { PaymentSource } from '../../../shared/enums/payment-source.enum';
import { DevicesService } from '../../devices/devices.service';
import { PaymentsService } from '../../payments/payments.service';
import { DeviceEventHandler, MqttInboundMessage } from '../interfaces/mqtt-message.interface';
import { PaymentFrameParser } from '../payment-frame.parser';

/**
 * Money in. Turns a `{root}/{uid}/events/payment` frame into a Payment row,
 * with the commission computed from that device tariffs.
 */
@Injectable()
export class PaymentHandler implements DeviceEventHandler {
  readonly event = 'payment';
  readonly name = 'payment';
  private readonly logger = new Logger(PaymentHandler.name);

  constructor(
    private readonly devices: DevicesService,
    private readonly payments: PaymentsService,
    private readonly parser: PaymentFrameParser,
  ) {}

  async handle(message: MqttInboundMessage): Promise<void> {
    const { deviceUid } = message.topic;

    const device = await this.devices.findByUid(deviceUid);
    if (!device) {
      // Money from a terminal nobody registered cannot be attributed to a
      // company. The id is in the unregistered pool and the frame is in
      // device_messages, so nothing is lost - it just waits for an admin.
      this.logger.warn(`Payment from unregistered device ${deviceUid} - frame stored, not booked`);
      return;
    }

    const parsed = this.parser.parse(message.frame, message.receivedAt);
    if (!parsed) {
      this.logger.warn(`Unparseable payment frame from ${deviceUid}: ${message.frame.hex}`);
      return;
    }

    await this.payments.record({
      deviceId: device.id,
      amount: parsed.amount,
      paidAt: parsed.paidAt,
      source: PaymentSource.TERMINAL,
      // Namespaced so two terminals cannot collide on a plain counter ref.
      externalRef: parsed.externalRef ? `${deviceUid}:${parsed.externalRef}` : null,
      raw: { topic: message.topic.raw, hex: message.frame.hex, details: parsed.details },
    });
  }
}
