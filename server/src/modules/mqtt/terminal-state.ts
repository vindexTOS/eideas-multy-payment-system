import { VidRecord } from './interfaces/mqtt-message.interface';
import { OPERATION_RESULT_LABELS, hexVid } from './protocol/terminal-protocol';

/** One terminal operation as last reported (0x81, 0x84, 0x95, ...). */
export interface TerminalOperationState {
  /** Catalogue key: 'payment', 'void', 'reconciliation', ... */
  operation: string;
  vid: string;
  result: number;
  resultLabel: string;
  amountTetri: number | null;
  at: string;
}

/** Shape of `devices.terminal_state`. Every key is optional: it is merged, never replaced. */
export interface TerminalState {
  paymentStatus?: 'idle' | 'busy';
  paymentStatusAt?: string;
  lastOperation?: TerminalOperationState;
  lastReconciliation?: TerminalOperationState;
}

export const operationState = (
  record: VidRecord,
  amountTetri: number | null,
  at: Date,
): TerminalOperationState => ({
  operation: record.key ?? hexVid(record.vid),
  vid: hexVid(record.vid),
  result: record.value ?? 0,
  resultLabel: OPERATION_RESULT_LABELS[record.value ?? 0] ?? `Unlisted (${record.value})`,
  amountTetri,
  at: at.toISOString(),
});
