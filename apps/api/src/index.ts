import { buildApp } from './app';
import { loadConfig } from './config';
import { connectDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { createLogger } from './logger';

const config = loadConfig();
const logger = createLogger(config.logLevel, config.env === 'development');

try {
  await runMigrations(config.databaseUrl);
  logger.info('Database schema is up to date');
} catch (error) {
  logger.fatal({ err: error }, 'Database migration failed');
  process.exit(1);
}

const database = connectDatabase(config.databaseUrl);
const app = await buildApp({
  db: database.db,
  logger,
  retellApiKey: config.retellApiKey,
});

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Shutting down');
  await app.close();
  await database.close();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  logger.fatal({ err: error }, 'Server failed to start');
  process.exit(1);
}
