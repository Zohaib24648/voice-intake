import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseConnection {
  db: Database;
  close: () => Promise<void>;
}

export function connectDatabase(databaseUrl: string): DatabaseConnection {
  const client = postgres(databaseUrl, { max: 10 });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}
