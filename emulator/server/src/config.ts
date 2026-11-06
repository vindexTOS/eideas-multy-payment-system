import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface EmulatorConfig {
  port: number;
  /** SQLite file. The emulator's own; it never touches the platform database. */
  dbPath: string;
  /** Built UI, served by this process. Absent in development (Vite serves it). */
  publicDir: string;
  /** Null password / secret: generated once and kept in the emulator's DB (AuthService). */
  superAdmin: { email: string; password: string | null };
  jwt: { secret: string | null; expiresIn: string };
  mqtt: {
    url: string;
    port: number;
    username?: string;
    password?: string;
    /** Must equal the listener's MQTT_ROOT_TOPIC, or the two never hear each other. */
    rootTopic: string;
    clientIdPrefix: string;
    qos: 0 | 1 | 2;
  };
  /**
   * Every emulated uid starts with this. It is what stops a virtual terminal
   * from ever taking the uid of a real one and booking fake money against a
   * real company.
   */
  uidPrefix: string;
}

const int = (name: string, fallback: number, min: number, max: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer ${min}-${max}, got "${raw}"`);
  }
  return value;
};

const text = (name: string, fallback: string): string => process.env[name]?.trim() || fallback;

/**
 * Local runs read `emulator/.env` (the same file docker compose uses) or a
 * `.env` in the working directory. Variables already set win. In docker
 * neither file exists and compose supplies the environment.
 */
const loadEnvFile = (): void => {
  const candidates = [resolve('.env'), resolve(__dirname, '../../.env')];
  const file = candidates.find((path) => existsSync(path));
  if (file) process.loadEnvFile(file);
};

export const loadConfig = (): EmulatorConfig => {
  loadEnvFile();
  const password = process.env.EMULATOR_SUPER_ADMIN_PASSWORD;
  const secret = process.env.EMULATOR_JWT_SECRET;
  const uidPrefix = text('EMULATOR_UID_PREFIX', 'EMU-');
  if (!/^[A-Za-z0-9_-]{2,16}$/.test(uidPrefix)) {
    throw new Error('EMULATOR_UID_PREFIX must be 2-16 of A-Z a-z 0-9 _ -');
  }

  return {
    port: int('EMULATOR_PORT', 8095, 1, 65535),
    dbPath: resolve(text('EMULATOR_DB_PATH', './data/emulator.db')),
    publicDir: resolve(text('EMULATOR_PUBLIC_DIR', './public')),
    superAdmin: {
      email: text('EMULATOR_SUPER_ADMIN_EMAIL', 'superadmin@emulator.local').toLowerCase(),
      password: password || null,
    },
    jwt: {
      secret: secret || null,
      expiresIn: text('EMULATOR_SESSION_TTL', '12h'),
    },
    mqtt: {
      url: text('MQTT_URL', 'mqtt://localhost'),
      port: int('MQTT_PORT', 1883, 1, 65535),
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      rootTopic: text('MQTT_ROOT_TOPIC', 'Pay'),
      clientIdPrefix: text('MQTT_CLIENT_ID_PREFIX', 'emu'),
      qos: int('MQTT_QOS', 1, 0, 2) as 0 | 1 | 2,
    },
    uidPrefix,
  };
};

export const EMULATOR_CONFIG = Symbol('EMULATOR_CONFIG');
