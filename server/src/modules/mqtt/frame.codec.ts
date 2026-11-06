import { Injectable } from '@nestjs/common';
import { DecodedFrame, VidRecord } from './interfaces/mqtt-message.interface';
import {
  VALUE_BYTE_ORDER,
  VID_CATALOGUE,
  hexVid,
  rangeProblem,
  valueWidth,
} from './protocol/terminal-protocol';

const HEADER_SIZE = 6;
const TIMESTAMP_SIZE = 4;
const RECORD_HEADER_SIZE = 2;

export type PayloadFieldType = 'string' | 'timestamp' | 'number' | 'number16' | 'number32' | 'raw';

export interface PayloadField {
  type: PayloadFieldType;
  value: string | number | Buffer;
}

/** One outbound terminal-protocol record. `value` is omitted for a bare command (0x51). */
export interface OutboundRecord {
  vid: number;
  value?: number;
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
 * After the timestamp, a terminal-protocol frame is a run of
 * `[VID][len][value]` records (protocol/terminal-protocol.ts); a one-record
 * frame is exactly the header above with the VID as the command byte.
 * Decoding stays tolerant: a plain JSON payload (the simulator) is parsed as
 * JSON, and nothing is ever dropped - the raw hex is always kept.
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
        records: null,
        protocolError: null,
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
        records: null,
        protocolError: null,
      };
    }

    const length = buffer.readUInt8(5);
    const payload = buffer.subarray(HEADER_SIZE, HEADER_SIZE + length);
    const { records, error } = this.decodeRecords(buffer);

    return {
      timestamp: buffer.readUInt32BE(0),
      command: buffer.readUInt8(4),
      length,
      payload,
      json: this.tryJson(payload),
      hex,
      framed: true,
      records,
      protocolError: error,
    };
  }

  /**
   * Build an outbound terminal-protocol frame: timestamp, then one record per
   * entry, in order. Refuses a VID the catalogue lacks, an event VID, and any
   * value outside the spec range - hardware never hears an out-of-spec value.
   * `allowEvents` is for the simulator, which builds terminal->server frames.
   */
  encodeRecords(records: OutboundRecord[], { allowEvents = false } = {}): Buffer {
    if (!records.length) throw new Error('A terminal frame needs at least one record');

    const parts = records.map(({ vid, value }) => {
      const definition = VID_CATALOGUE.get(vid);
      if (!definition) throw new Error(`Unknown VID ${hexVid(vid)}`);
      if (definition.kind === 'event' && !allowEvents) {
        throw new Error(
          `${definition.key} (${hexVid(vid)}) is an event; terminals send it, never receive it`,
        );
      }
      const problem = rangeProblem(definition, value);
      if (problem) throw new Error(problem);

      const width = valueWidth(definition.type);
      const record = Buffer.alloc(RECORD_HEADER_SIZE + width);
      record.writeUInt8(vid, 0);
      record.writeUInt8(width, 1);
      if (width === 1) record.writeUInt8(value as number, 2);
      if (width === 2) {
        if (VALUE_BYTE_ORDER === 'le') record.writeUInt16LE(value as number, 2);
        else record.writeUInt16BE(value as number, 2);
      }
      return record;
    });

    const timestamp = Buffer.alloc(TIMESTAMP_SIZE);
    timestamp.writeUInt32LE(Math.floor(Date.now() / 1000), 0);
    return Buffer.concat([timestamp, ...parts]);
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

  /**
   * Walk `[VID][len][value]` records from just after the timestamp. The run
   * must end exactly at the end of the buffer, a known VID must carry the
   * width its type defines, and at least one VID must be known - otherwise
   * this is not a terminal-protocol frame. Unknown VIDs are kept raw, so a
   * firmware that adds a VID does not make the whole frame unreadable.
   */
  private decodeRecords(buffer: Buffer): { records: VidRecord[] | null; error: string | null } {
    const records: VidRecord[] = [];
    let offset = TIMESTAMP_SIZE;

    while (offset < buffer.length) {
      if (offset + RECORD_HEADER_SIZE > buffer.length) {
        return { records: null, error: `Record at byte ${offset} is cut short` };
      }
      const vid = buffer.readUInt8(offset);
      const length = buffer.readUInt8(offset + 1);
      const start = offset + RECORD_HEADER_SIZE;
      if (start + length > buffer.length) {
        return {
          records: null,
          error: `${hexVid(vid)} declares ${length} bytes, only ${buffer.length - start} left`,
        };
      }

      const bytes = buffer.subarray(start, start + length);
      const definition = VID_CATALOGUE.get(vid);
      if (definition && length !== valueWidth(definition.type)) {
        return {
          records: null,
          error: `${definition.key} (${hexVid(vid)}) must carry ${valueWidth(definition.type)} bytes, got ${length}`,
        };
      }

      records.push({
        vid,
        key: definition?.key ?? null,
        length,
        value: definition ? this.readValue(bytes) : null,
        hex: bytes.toString('hex'),
      });
      offset = start + length;
    }

    if (!records.some((record) => record.key !== null)) return { records: null, error: null };
    return { records, error: null };
  }

  private readValue(bytes: Buffer): number | null {
    if (bytes.length === 1) return bytes.readUInt8(0);
    if (bytes.length === 2) {
      return VALUE_BYTE_ORDER === 'le' ? bytes.readUInt16LE(0) : bytes.readUInt16BE(0);
    }
    return null;
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
