import { loadConfig } from './config';
import { runMigrations } from './db/migrate';
import { createLogger } from './logger';

const config = loadConfig();
const logger = createLogger(config.logLevel, config.env === 'development');

try {
  await runMigrations(config.databaseUrl);
  logger.info('Database migrations applied');
} catch (error) {
  logger.fatal({ err: error }, 'Database migration failed');
  process.exit(1);
}
