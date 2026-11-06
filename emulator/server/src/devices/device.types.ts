import { DecodedRecord, RESULT, TerminalConfig } from '../protocol/terminal-protocol';

/**
 * How a virtual terminal answers the server.
 *  auto   - a 0x50 / 0x51 is answered by itself after `responseDelayMs`
 *  manual - it waits, like a terminal waiting for a card, until you answer
 *           from the UI with the result of your choice
 */
export type Mode = 'auto' | 'manual';

export interface Behaviour {
  mode: Mode;
  /** Result reported for an auto-answered 0x50. */
  paymentResult: number;
  /** Result reported for an auto-answered 0x51. */
  reconciliationResult: number;
  responseDelayMs: number;
  /** 0 = off. Sends the current 0x82 status on events/heartbeat. */
  heartbeatSeconds: number;
}

export const DEFAULT_BEHAVIOUR: Readonly<Behaviour> = Object.freeze({
  mode: 'auto',
  paymentResult: RESULT.SUCCESS,
  reconciliationResult: RESULT.SUCCESS,
  responseDelayMs: 1500,
  heartbeatSeconds: 60,
});

export interface DeviceRecord {
  id: string;
  uid: string;
  name: string;
  /** Desired connection state; restored when the emulator restarts. */
  autoConnect: boolean;
  behaviour: Behaviour;
  /** Config as last received from the server (0x01-0x08); null until then. */
  config: TerminalConfig | null;
  configReceivedAt: string | null;
  createdAt: string;
}

export type Pending =
  | { kind: 'payment'; amountTetri: number; since: string }
  | { kind: 'reconciliation'; since: string };

export interface TerminalRuntime {
  connected: boolean;
  /** The client exists and is (re)trying, whether or not the broker answered yet. */
  online: boolean;
  paymentStatus: 'idle' | 'busy';
  /** A 0x50 / 0x51 waiting for an answer. */
  pending: Pending | null;
  lastError: string | null;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
}

export interface DeviceView extends DeviceRecord {
  runtime: TerminalRuntime;
}

export type Direction = 'in' | 'out' | 'note';

export interface FrameEntry {
  id: number;
  deviceId: string;
  direction: Direction;
  topic: string | null;
  hex: string | null;
  summary: string;
  records: DecodedRecord[] | null;
  at: string;
}

export type NewFrameEntry = Omit<FrameEntry, 'id' | 'deviceId' | 'at'>;
