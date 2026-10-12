import { randomBytes } from 'node:crypto';
export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  synchronize: boolean;
  logging: boolean;
  ssl: boolean;
}

export interface JwtConfig {
  secret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export interface MqttConfig {
  enabled: boolean;
  url: string;
  port: number;
  username?: string;
  password?: string;
  clientIdPrefix: string;
  qos: 0 | 1 | 2;
  /** Root namespace of every topic this platform owns, e.g. `Pay`. */
  rootTopic: string;
  /** Persist every inbound frame into device_messages (useful until device docs land). */
  logRawMessages: boolean;
  /** Opcode that carries a payment, once the device spec confirms it. */
  paymentCommand: number;
  /** Minor-unit divisor (100 = tetri -> lari). */
  amountDivisor: number;
  /** Guard rail: book money from undocumented BINARY frames only when true. */
  binaryPaymentsEnabled: boolean;
}

export interface SeedConfig {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  mqtt: MqttConfig;
  seed: SeedConfig;
}

const toBool = (value: string | undefined, fallback = false): boolean =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default (): Configuration => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: toInt(process.env.PORT, 4000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((o) => o.trim()),
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'eideas_payments',
    schema: process.env.DB_SCHEMA ?? 'public',
    synchronize: toBool(process.env.DB_SYNCHRONIZE, process.env.NODE_ENV !== 'production'),
    logging: toBool(process.env.DB_LOGGING, false),
    ssl: toBool(process.env.DB_SSL, false),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-access',
    accessExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  mqtt: {
    enabled: toBool(process.env.MQTT_ENABLED, true),
    url: process.env.MQTT_URL ?? 'mqtt://localhost',
    port: toInt(process.env.MQTT_PORT, 1883),
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientIdPrefix: process.env.MQTT_CLIENT_ID_PREFIX ?? 'eideas-pay',
    qos: toInt(process.env.MQTT_QOS, 1) as 0 | 1 | 2,
    rootTopic: process.env.MQTT_ROOT_TOPIC ?? 'Pay',
    logRawMessages: toBool(process.env.MQTT_LOG_RAW, true),
    paymentCommand: toInt(process.env.MQTT_PAYMENT_COMMAND, 4),
    amountDivisor: toInt(process.env.MQTT_AMOUNT_DIVISOR, 100),
    binaryPaymentsEnabled: toBool(process.env.MQTT_BINARY_PAYMENTS, false),
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@eideas.io',
    // No working default ships in the repo: an unset password becomes a
    // random one, which SeedService prints once so it can be used and changed.
    adminPassword: process.env.SEED_ADMIN_PASSWORD || randomBytes(12).toString('base64url'),
    adminName: process.env.SEED_ADMIN_NAME ?? 'System Administrator',
  },
});
