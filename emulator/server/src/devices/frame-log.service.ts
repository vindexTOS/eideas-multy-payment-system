import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventBusService } from '../events/event-bus.service';
import { FrameEntry, NewFrameEntry } from './device.types';

/** Frames kept per device; older ones are pruned as new ones arrive. */
const KEEP_PER_DEVICE = 1000;

interface FrameRow {
  id: number;
  device_id: string;
  direction: FrameEntry['direction'];
  topic: string | null;
  hex: string | null;
  summary: string;
  records: string | null;
  at: string;
}

/** Everything a virtual terminal sent, received or decided, in order. */
@Injectable()
export class FrameLogService {
  constructor(
    private readonly database: DatabaseService,
    private readonly bus: EventBusService,
  ) {}

  write(deviceId: string, entry: NewFrameEntry): FrameEntry {
    const at = new Date().toISOString();
    const { db } = this.database;
    const result = db
      .prepare(
        'INSERT INTO frames (device_id, direction, topic, hex, summary, records, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        deviceId,
        entry.direction,
        entry.topic,
        entry.hex,
        entry.summary,
        entry.records ? JSON.stringify(entry.records) : null,
        at,
      );
    db.prepare(
      `DELETE FROM frames WHERE device_id = ? AND id <= (
         SELECT id FROM frames WHERE device_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?
       )`,
    ).run(deviceId, deviceId, KEEP_PER_DEVICE);

    const frame: FrameEntry = { id: Number(result.lastInsertRowid), deviceId, at, ...entry };
    this.bus.emit({ type: 'frame', frame });
    return frame;
  }

  /** Newest first. */
  list(deviceId: string, limit: number): FrameEntry[] {
    const rows = this.database.db
      .prepare('SELECT * FROM frames WHERE device_id = ? ORDER BY id DESC LIMIT ?')
      .all(deviceId, limit) as unknown as FrameRow[];
    return rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      direction: row.direction,
      topic: row.topic,
      hex: row.hex,
      summary: row.summary,
      records: row.records ? JSON.parse(row.records) : null,
      at: row.at,
    }));
  }

  clear(deviceId: string): void {
    this.database.db.prepare('DELETE FROM frames WHERE device_id = ?').run(deviceId);
  }
}
