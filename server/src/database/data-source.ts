import 'reflect-metadata';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration';

/** Used only by the typeorm CLI (migration:generate / migration:run). */
const { database } = configuration();

export default new DataSource({
  type: 'postgres',
  host: database.host,
  port: database.port,
  username: database.username,
  password: database.password,
  database: database.database,
  schema: database.schema,
  ssl: database.ssl ? { rejectUnauthorized: false } : false,
  entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
});
