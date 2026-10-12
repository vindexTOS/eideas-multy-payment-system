import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttConfig } from '../../config/configuration';
import { round2 } from '../../shared/utils/money.util';
import { DecodedFrame } from './interfaces/mqtt-message.interface';

export interface ParsedPaymentFrame {
  amount: number;
  /** Idempotency key, when the device supplies one. */
  externalRef: string | null;
  paidAt: Date;
  /** Everything we understood, stored on the payment row. */
  details: Record<string, unknown>;
}

const AMOUNT_KEYS = ['amount', 'sum', 'value', 'total', 'paid'];
const MINOR_AMOUNT_KEYS = ['amount_minor', 'amountMinor', 'tetri', 'cents'];
const REF_KEYS = ['ref', 'reference', 'txn', 'txnId', 'transactionId', 'receipt', 'id'];
const TIME_KEYS = ['paidAt', 'paid_at', 'timestamp', 'ts', 'time'];

/**
 * Pulls "how much money, which transaction, when" out of a device frame.
 *
 * THE DEVICE PROTOCOL IS NOT DOCUMENTED YET. That shapes two decisions:
 *
 *  1. JSON payloads are parsed generously (several key spellings), which is
 *     enough for the simulator endpoint and for most terminals in the wild.
 *  2. Binary payloads are NOT guessed at by default. Inventing a byte offset
 *     would mean inventing money. Such frames are logged with their raw hex
 *     and skipped until MQTT_BINARY_PAYMENTS=true states the layout below is
 *     confirmed.
 *
 * Assumed binary layout once enabled (mirrors the lift terminals):
 *   command = MQTT_PAYMENT_COMMAND, payload[0..3] = amount, uint32 LE, in
 *   minor units (divided by MQTT_AMOUNT_DIVISOR), remaining bytes = utf8 ref.
 */
@Injectable()
export class PaymentFrameParser {
  private readonly logger = new Logger(PaymentFrameParser.name);
  private readonly config: MqttConfig;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<MqttConfig>('mqtt');
  }

  parse(frame: DecodedFrame, receivedAt: Date): ParsedPaymentFrame | null {
    const json = frame.json;
    if (json) return this.fromJson(json, receivedAt);
    if (frame.framed) return this.fromBinary(frame, receivedAt);
    return null;
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

  private fromBinary(frame: DecodedFrame, receivedAt: Date): ParsedPaymentFrame | null {
    if (!this.config.binaryPaymentsEnabled) {
      this.logger.warn(
        `Binary payment frame skipped (command=${frame.command}, hex=${frame.hex}). ` +
          'Set MQTT_BINARY_PAYMENTS=true once the device protocol is confirmed.',
      );
      return null;
    }
    if (frame.command !== this.config.paymentCommand || frame.payload.length < 4) return null;

    const raw = frame.payload.readUInt32LE(0);
    const amount = round2(raw / this.config.amountDivisor);
    if (amount <= 0) return null;

    const refBytes = frame.payload.subarray(4);
    const externalRef = refBytes.length
      ? refBytes.toString('utf8').replace(/\0+$/, '').trim() || null
      : null;

    return {
      amount,
      externalRef,
      paidAt: frame.timestamp ? new Date(frame.timestamp * 1000) : receivedAt,
      details: {
        command: frame.command,
        amountRaw: raw,
        divisor: this.config.amountDivisor,
        hex: frame.hex,
      },
    };
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
