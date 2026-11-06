import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { MqttConfig } from '../../config/configuration';
import { round2 } from '../../shared/utils/money.util';
import { DecodedFrame } from './interfaces/mqtt-message.interface';
import {
  OPERATION_RESULT_LABELS,
  OperationResult,
  VID,
  VID_CATALOGUE,
  rangeProblem,
} from './protocol/terminal-protocol';

export interface ParsedPaymentFrame {
  amount: number;
  /** Idempotency key, when the device supplies one. */
  externalRef: string | null;
  paidAt: Date;
  /** Everything we understood, stored on the payment row. */
  details: Record<string, unknown>;
}

/** What a terminal-protocol payment frame (0x81 + 0x80) amounts to. */
export type TerminalPaymentOutcome =
  | { kind: 'book'; result: OperationResult; payment: ParsedPaymentFrame }
  /** The terminal reported a result under which no money moved. */
  | { kind: 'declined'; result: number; amountTetri: number | null }
  /** Claims to be a payment but cannot be booked; the reason goes to the audit log. */
  | { kind: 'invalid'; reason: string };

const AMOUNT_KEYS = ['amount', 'sum', 'value', 'total', 'paid'];
const MINOR_AMOUNT_KEYS = ['amount_minor', 'amountMinor', 'tetri', 'cents'];
const REF_KEYS = ['ref', 'reference', 'txn', 'txnId', 'transactionId', 'receipt', 'id'];
const TIME_KEYS = ['paidAt', 'paid_at', 'timestamp', 'ts', 'time'];

/**
 * Results that mean money moved. PARTLY_SUCCESS is booked at the 0x80
 * amount, flagged `partial` on the row - confirm with the firmware author
 * that 0x80 is then the approved amount, not the requested one.
 */
const BOOKABLE_RESULTS: ReadonlySet<number> = new Set([
  OperationResult.SUCCESS,
  OperationResult.PARTLY_SUCCESS,
]);

/** A device clock before this is unset, not a payment time (2024-01-01 UTC). */
const EARLIEST_DEVICE_CLOCK = 1_704_067_200;
/** How far ahead of the server a device clock may run and still be believed. */
const CLOCK_SKEW_SECONDS = 86_400;

const swap32 = (n: number): number =>
  (((n & 0xff) << 24) | ((n & 0xff00) << 8) | ((n >>> 8) & 0xff00) | (n >>> 24)) >>> 0;

/**
 * Pulls "how much money, which transaction, when" out of a device frame.
 *
 * Two shapes:
 *  1. Terminal-protocol frames: 0x81 (result) + 0x80 (amount, tetri) in one
 *     frame. The spec carries no transaction id, so the idempotency key is
 *     the device clock plus a hash of the frame - a QoS 1 redelivery is
 *     byte-identical, and one terminal cannot take two payments in the same
 *     second. With no believable clock there is no key: double-counting a
 *     redelivery can be reversed, a payment dropped as a "duplicate" cannot.
 *  2. JSON payloads (the simulator), parsed generously with several key
 *     spellings.
 */
@Injectable()
export class PaymentFrameParser {
  private readonly config: MqttConfig;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<MqttConfig>('mqtt');
  }

  /** JSON payment frames. Terminal-protocol frames go through `parseTerminal`. */
  parse(frame: DecodedFrame, receivedAt: Date): ParsedPaymentFrame | null {
    return frame.json ? this.fromJson(frame.json, receivedAt) : null;
  }

  parseTerminal(frame: DecodedFrame, receivedAt: Date): TerminalPaymentOutcome {
    const records = frame.records ?? [];
    const result = records.find((r) => r.vid === VID.PAYMENT)?.value ?? null;
    if (result === null) return { kind: 'invalid', reason: 'Frame has no 0x81 payment result' };

    const amountTetri = records.find((r) => r.vid === VID.TRANSACTION_AMOUNT)?.value ?? null;
    if (!BOOKABLE_RESULTS.has(result)) return { kind: 'declined', result, amountTetri };

    const resultLabel = OPERATION_RESULT_LABELS[result];
    if (amountTetri === null) {
      return {
        kind: 'invalid',
        reason: `Payment "${resultLabel}" without a 0x80 amount in the same frame - not booked`,
      };
    }
    const problem = rangeProblem(VID_CATALOGUE.get(VID.TRANSACTION_AMOUNT)!, amountTetri);
    if (problem) {
      return {
        kind: 'invalid',
        reason: `${problem} - not booked (wrong VALUE_BYTE_ORDER would look like this)`,
      };
    }

    const clock = this.deviceClock(frame, receivedAt);
    return {
      kind: 'book',
      result,
      payment: {
        amount: round2(amountTetri / this.config.amountDivisor),
        externalRef: clock
          ? `${clock}-${createHash('sha1').update(frame.hex).digest('hex').slice(0, 12)}`
          : null,
        paidAt: clock ? new Date(clock * 1000) : receivedAt,
        details: {
          result,
          resultLabel,
          partial: result === OperationResult.PARTLY_SUCCESS,
          amountTetri,
          deviceClock: frame.timestamp,
          records: frame.records,
        },
      },
    };
  }

  private fromJson(json: Record<string, unknown>, receivedAt: Date): ParsedPaymentFrame | null {
    const minor = this.pickNumber(json, MINOR_AMOUNT_KEYS);
    const major = this.pickNumber(json, AMOUNT_KEYS);
    const amount =
      minor !== null
        ? round2(minor / this.config.amountDivisor)
        : major !== null
          ? round2(major)
          : null;

    if (amount === null || amount <= 0) return null;

    return {
      amount,
      externalRef: this.pickString(json, REF_KEYS),
      paidAt: this.pickDate(json, TIME_KEYS) ?? receivedAt,
      details: json,
    };
  }

  /**
   * Device clock in unix seconds, or null when it is not a believable wall
   * clock. The header timestamp is read big-endian (as the lift terminals
   * send it); a little-endian clock is recognised too, since a wall clock
   * read in the wrong byte order is never inside the believable window.
   */
  private deviceClock(frame: DecodedFrame, receivedAt: Date): number | null {
    if (frame.timestamp === null) return null;
    const latest = receivedAt.getTime() / 1000 + CLOCK_SKEW_SECONDS;
    for (const seconds of [frame.timestamp, swap32(frame.timestamp)]) {
      if (seconds >= EARLIEST_DEVICE_CLOCK && seconds <= latest) return seconds;
    }
    return null;
  }

  private pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  }

  private pickString(source: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
      if (typeof value === 'number') return String(value);
    }
    return null;
  }

  private pickDate(source: Record<string, unknown>, keys: string[]): Date | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number') {
        // Unix seconds vs milliseconds, told apart by magnitude.
        const date = new Date(value > 1e12 ? value : value * 1000);
        if (!Number.isNaN(date.getTime())) return date;
      }
      if (typeof value === 'string') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
    return null;
  }
}
