import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { EMULATOR_CONFIG, EmulatorConfig } from '../config';

/**
 * The emulator's own SQLite file. It has nothing to do with the platform's
 * Postgres: delete the file and the emulator starts empty, the platform does
 * not notice.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly db: DatabaseSync;

  constructor(@Inject(EMULATOR_CONFIG) config: EmulatorConfig) {
    mkdirSync(dirname(config.dbPath), { recursive: true });
    this.db = new DatabaseSync(config.dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS devices (
        id                 TEXT PRIMARY KEY,
        uid                TEXT NOT NULL UNIQUE,
        name               TEXT NOT NULL,
        auto_connect       INTEGER NOT NULL DEFAULT 1,
        behaviour          TEXT NOT NULL,
        config             TEXT,
        config_received_at TEXT,
        created_at         TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS frames (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        direction  TEXT NOT NULL,
        topic      TEXT,
        hex        TEXT,
        summary    TEXT NOT NULL,
        records    TEXT,
        at         TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_frames_device ON frames (device_id, id);

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.logger.log(`Database ${config.dbPath}`);
  }

  setting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      { value: string } | undefined;
    return row?.value ?? null;
  }

  saveSetting(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }

  onModuleDestroy(): void {
    this.db.close();
  }
}
