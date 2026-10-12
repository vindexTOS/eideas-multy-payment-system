import { Injectable } from '@nestjs/common';
import { DecodedFrame } from './interfaces/mqtt-message.interface';

const HEADER_SIZE = 6;

export type PayloadFieldType = 'string' | 'timestamp' | 'number' | 'number16' | 'number32' | 'raw';

export interface PayloadField {
  type: PayloadFieldType;
  value: string | number | Buffer;
}

/**
 * Wire codec for terminal frames.
 *
 * Framing (same shape the lift terminals already speak):
 *   [0..3] timestamp  uint32 BE
 *   [4]    command    uint8
 *   [5]    length     uint8
 *   [6..]  payload    `length` bytes
 *
 * The payment device protocol is NOT documented yet, so decoding is
 * deliberately tolerant: a plain JSON payload is parsed as JSON, anything
 * else is kept as bytes plus hex. Nothing is ever dropped - the raw hex is
 * persisted so frames can be re-read once the spec arrives.
 */
@Injectable()
export class FrameCodec {
  decode(buffer: Buffer): DecodedFrame {
    const hex = buffer.toString('hex');

    // A JSON-speaking device is plausible; try that before binary framing.
    const asJson = this.tryJson(buffer);
    if (asJson) {
      return {
        timestamp: typeof asJson.timestamp === 'number' ? asJson.timestamp : null,
        command: typeof asJson.command === 'number' ? asJson.command : null,
        length: buffer.length,
        payload: buffer,
        json: asJson,
        hex,
        framed: false,
      };
    }

    if (buffer.length < HEADER_SIZE) {
      return {
        timestamp: null,
        command: null,
        length: null,
        payload: buffer,
        json: null,
        hex,
        framed: false,
      };
    }

    const length = buffer.readUInt8(5);
    const payload = buffer.subarray(HEADER_SIZE, HEADER_SIZE + length);

    return {
      timestamp: buffer.readUInt32BE(0),
      command: buffer.readUInt8(4),
      length,
      payload,
      json: this.tryJson(payload),
      hex,
      framed: true,
    };
  }

  /** Build an outbound command frame (little-endian, as the terminals expect). */
  encode(command: number, fields: PayloadField[] = []): Buffer {
    const header = Buffer.alloc(5);
    header.writeUInt32LE(Math.floor(Date.now() / 1000), 0);
    header.writeUInt8(command, 4);

    const parts: Buffer[] = [];
    for (const field of fields) {
      parts.push(this.encodeField(field));
    }

    const payload = Buffer.concat(parts);
    const size = Buffer.alloc(1);
    size.writeUInt8(Math.min(payload.length, 255), 0);

    return Buffer.concat([header, size, payload]);
  }

  private encodeField(field: PayloadField): Buffer {
    switch (field.type) {
      case 'string':
        return Buffer.from(String(field.value), 'utf8');
      case 'raw':
        return Buffer.isBuffer(field.value) ? field.value : Buffer.from(String(field.value));
      case 'number': {
        const buf = Buffer.alloc(1);
        buf.writeUInt8(Number(field.value) & 0xff, 0);
        return buf;
      }
      case 'number16': {
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(Number(field.value) & 0xffff, 0);
        return buf;
      }
      case 'timestamp':
      case 'number32': {
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(Number(field.value) >>> 0, 0);
        return buf;
      }
      default:
        return Buffer.alloc(0);
    }
  }

  private tryJson(buffer: Buffer): Record<string, unknown> | null {
    const text = buffer.toString('utf8').trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return null;
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}
