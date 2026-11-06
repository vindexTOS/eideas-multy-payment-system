import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Behaviour, DEFAULT_BEHAVIOUR, DeviceRecord } from './device.types';

interface DeviceRow {
  id: string;
  uid: string;
  name: string;
  auto_connect: number;
  behaviour: string;
  config: string | null;
  config_received_at: string | null;
  created_at: string;
}

const toRecord = (row: DeviceRow): DeviceRecord => ({
  id: row.id,
  uid: row.uid,
  name: row.name,
  autoConnect: row.auto_connect === 1,
  // Merged over the defaults so a behaviour key added later has a value.
  behaviour: { ...DEFAULT_BEHAVIOUR, ...(JSON.parse(row.behaviour) as Partial<Behaviour>) },
  config: row.config ? (JSON.parse(row.config) as Record<string, number>) : null,
  configReceivedAt: row.config_received_at,
  createdAt: row.created_at,
});

@Injectable()
export class DevicesRepository {
  constructor(private readonly database: DatabaseService) {}

  all(): DeviceRecord[] {
    const rows = this.database.db
      .prepare('SELECT * FROM devices ORDER BY created_at DESC')
      .all() as unknown as DeviceRow[];
    return rows.map(toRecord);
  }

  byId(id: string): DeviceRecord | null {
    const row = this.database.db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    return row ? toRecord(row as unknown as DeviceRow) : null;
  }

  uidTaken(uid: string): boolean {
    return !!this.database.db.prepare('SELECT 1 FROM devices WHERE uid = ?').get(uid);
  }

  insert(device: DeviceRecord): void {
    this.database.db
      .prepare(
        `INSERT INTO devices (id, uid, name, auto_connect, behaviour, config, config_received_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        device.id,
        device.uid,
        device.name,
        device.autoConnect ? 1 : 0,
        JSON.stringify(device.behaviour),
        device.config ? JSON.stringify(device.config) : null,
        device.configReceivedAt,
        device.createdAt,
      );
  }

  update(device: DeviceRecord): void {
    this.database.db
      .prepare(
        `UPDATE devices SET name = ?, auto_connect = ?, behaviour = ?, config = ?, config_received_at = ?
         WHERE id = ?`,
      )
      .run(
        device.name,
        device.autoConnect ? 1 : 0,
        JSON.stringify(device.behaviour),
        device.config ? JSON.stringify(device.config) : null,
        device.configReceivedAt,
        device.id,
      );
  }

  /** Frames go with it (ON DELETE CASCADE). */
  remove(id: string): void {
    this.database.db.prepare('DELETE FROM devices WHERE id = ?').run(id);
  }
}
