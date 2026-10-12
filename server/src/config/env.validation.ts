import * as Joi from 'joi';

/**
 * Fail fast on boot instead of discovering a missing DB password three
 * requests into production.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().default('*'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_DATABASE: Joi.string().required(),
  DB_SCHEMA: Joi.string().default('public'),
  DB_SYNCHRONIZE: Joi.string().optional(),
  DB_LOGGING: Joi.string().optional(),
  DB_SSL: Joi.string().optional(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  MQTT_ENABLED: Joi.string().optional(),
  MQTT_URL: Joi.string().optional(),
  MQTT_PORT: Joi.number().optional(),
  MQTT_USERNAME: Joi.string().allow('').optional(),
  MQTT_PASSWORD: Joi.string().allow('').optional(),
  MQTT_CLIENT_ID_PREFIX: Joi.string().optional(),
  MQTT_QOS: Joi.number().valid(0, 1, 2).optional(),
  MQTT_ROOT_TOPIC: Joi.string().optional(),
  MQTT_LOG_RAW: Joi.string().optional(),
  MQTT_PAYMENT_COMMAND: Joi.number().optional(),
  MQTT_AMOUNT_DIVISOR: Joi.number().optional(),
  MQTT_BINARY_PAYMENTS: Joi.string().optional(),

  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
  SEED_ADMIN_NAME: Joi.string().optional(),
}).unknown(true);
