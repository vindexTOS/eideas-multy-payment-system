import { Injectable, Logger } from '@nestjs/common';
import { DevicesService } from '../../devices/devices.service';
import { DeviceEventHandler, MqttInboundMessage } from '../interfaces/mqtt-message.interface';
import { OPERATION_VIDS, OperationResult, VID, VID_CATALOGUE } from '../protocol/terminal-protocol';
import { TerminalState, operationState } from '../terminal-state';

/** Operations that, on success, mean money went back to the card. */
const MONEY_BACK_VIDS: ReadonlySet<number> = new Set([
  VID.CANCEL,
  VID.CANCEL_9A,
  VID.RETURN,
  VID.VOID,
]);

/**
 * Every operation result except the payment itself: cancel, wait, return,
 * void and reconciliation. Recorded on the device's terminal state.
 *
 * A successful void/return/cancel does NOT reverse a payment by itself. The
 * spec carries no transaction id, so the only way to pick "which payment"
 * would be to guess (latest one, same amount), and a wrong guess silently
 * removes real money from a company's earnings. It is logged loudly instead;
 * reverse the payment from the payments page.
 */
@Injectable()
export class TerminalOperationHandler implements DeviceEventHandler {
  readonly event = 'operation';
  readonly vids = OPERATION_VIDS.filter((vid) => vid !== VID.PAYMENT);
  readonly name = 'terminal-operation';
  private readonly logger = new Logger(TerminalOperationHandler.name);

  constructor(private readonly devices: DevicesService) {}

  async handle(message: MqttInboundMessage): Promise<void> {
    const device = await this.devices.findByUid(message.topic.deviceUid);
    if (!device) return;

    const records = message.frame.records ?? [];
    const amountTetri = records.find((r) => r.vid === VID.TRANSACTION_AMOUNT)?.value ?? null;
    const state: TerminalState = {};

    for (const record of records) {
      if (!this.vids.includes(record.vid) || record.value === null) continue;

      const operation = operationState(record, amountTetri, message.receivedAt);
      state.lastOperation = operation;
      if (record.vid === VID.RECONCILIATION) state.lastReconciliation = operation;

      const label = VID_CATALOGUE.get(record.vid)?.label ?? operation.vid;
      const ok = record.value === OperationResult.SUCCESS;
      this.logger[ok ? 'log' : 'warn'](
        `${device.deviceUid}: ${label} -> ${operation.resultLabel}` +
          (amountTetri !== null ? ` (${amountTetri} tetri)` : ''),
      );
      if (ok && MONEY_BACK_VIDS.has(record.vid)) {
        this.logger.warn(
          `${device.deviceUid}: successful ${label} - no payment reversed automatically ` +
            '(the protocol carries no transaction id); reverse it from the payments page',
        );
      }
    }

    if (Object.keys(state).length) {
      await this.devices.patchTerminalState(device.id, state as Record<string, unknown>);
    }
    await this.devices.markSeen(device.id, message.receivedAt);
  }
}
