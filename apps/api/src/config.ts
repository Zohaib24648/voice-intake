import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.url({ error: 'DATABASE_URL must be a valid connection string' }),
  RETELL_API_KEY: z.string().min(1, 'RETELL_API_KEY is required to verify webhook signatures'),
});

export interface Config {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  databaseUrl: string;
  retellApiKey: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = environmentSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }

  return {
    env: parsed.data.NODE_ENV,
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    logLevel: parsed.data.LOG_LEVEL,
    databaseUrl: parsed.data.DATABASE_URL,
    retellApiKey: parsed.data.RETELL_API_KEY,
  };
}
