import { Injectable, Logger } from '@nestjs/common';
import { PaymentSource } from '../../../shared/enums/payment-source.enum';
import { Device } from '../../devices/entities/device.entity';
import { DevicesService } from '../../devices/devices.service';
import { PaymentsService } from '../../payments/payments.service';
import { DeviceEventHandler, MqttInboundMessage } from '../interfaces/mqtt-message.interface';
import { ParsedPaymentFrame, PaymentFrameParser } from '../payment-frame.parser';
import { OPERATION_RESULT_LABELS, VID } from '../protocol/terminal-protocol';
import { TerminalState, operationState } from '../terminal-state';

/**
 * Money in. Turns a payment frame into a Payment row, with the commission
 * computed from that device tariffs.
 *
 * Terminal frames: VID 0x81 (result) + 0x80 (amount, tetri). Only a result
 * under which money moved is booked; a decline is recorded on the device's
 * terminal state. JSON frames on `{root}/{uid}/events/payment` are the
 * simulator's path.
 */
@Injectable()
export class PaymentHandler implements DeviceEventHandler {
  readonly event = 'payment';
  readonly vids = [VID.PAYMENT];
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

    if (message.frame.records) {
      await this.handleTerminalFrame(device, message);
      return;
    }

    const parsed = this.parser.parse(message.frame, message.receivedAt);
    if (!parsed) {
      this.logger.warn(`Unparseable payment frame from ${deviceUid}: ${message.frame.hex}`);
      return;
    }
    await this.book(device, message, parsed);
  }

  private async handleTerminalFrame(device: Device, message: MqttInboundMessage): Promise<void> {
    const outcome = this.parser.parseTerminal(message.frame, message.receivedAt);
    // Thrown, not logged: the router then persists the frame with this
    // reason whatever MQTT_LOG_RAW says, since it claimed to be money.
    if (outcome.kind === 'invalid') throw new Error(outcome.reason);

    const records = message.frame.records ?? [];
    const result = records.find((r) => r.vid === VID.PAYMENT)!;
    const amountTetri = records.find((r) => r.vid === VID.TRANSACTION_AMOUNT)?.value ?? null;
    const state: TerminalState = {
      lastOperation: operationState(result, amountTetri, message.receivedAt),
    };
    await this.devices.patchTerminalState(device.id, state as Record<string, unknown>);

    if (outcome.kind === 'declined') {
      this.logger.log(
        `Payment on ${device.deviceUid} not completed: ${OPERATION_RESULT_LABELS[outcome.result] ?? outcome.result}`,
      );
      await this.devices.markSeen(device.id, message.receivedAt);
      return;
    }

    if (outcome.payment.details.partial) {
      this.logger.warn(
        `Partly successful payment on ${device.deviceUid} booked at the 0x80 amount`,
      );
    }
    await this.book(device, message, outcome.payment);
  }

  private async book(
    device: Device,
    message: MqttInboundMessage,
    parsed: ParsedPaymentFrame,
  ): Promise<void> {
    const { deviceUid } = message.topic;
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
