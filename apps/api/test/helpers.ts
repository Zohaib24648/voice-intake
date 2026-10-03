import { PGlite } from '@electric-sql/pglite';
import type { CreatePatientInput } from '@voice-intake/shared';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import pino from 'pino';
import Retell from 'retell-sdk';
import { buildApp, type App } from '../src/app';
import type { Database } from '../src/db/client';
import * as schema from '../src/db/schema';
import { MIGRATIONS_DIR } from '../src/paths';
import { SIGNATURE_HEADER } from '../src/voice/signature';
import { EVENTS_PATH, TOOLS_PATH } from '../src/voice/webhook';

const TEST_RETELL_API_KEY = 'key_test_retell_api_key_for_signatures';

export interface TestContext {
  app: App;
  db: Database;
  close: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

  const app = await buildApp({
    db,
    logger: pino({ level: 'silent' }),
    retellApiKey: TEST_RETELL_API_KEY,
  });
  await app.ready();

  return {
    app,
    db,
    close: async () => {
      await app.close();
      await client.close();
    },
  };
}

export const validPatientInput: CreatePatientInput = {
  first_name: 'Jane',
  last_name: 'Davis',
  date_of_birth: '03/15/1985',
  sex: 'female',
  phone_number: '(555) 010-1234',
  address_line_1: '123 Main Street',
  city: 'Springfield',
  state: 'il',
  zip_code: '62701',
};

export async function createPatient(app: App, overrides: Partial<CreatePatientInput> = {}) {
  const response = await app.inject({
    method: 'POST',
    url: '/patients',
    payload: { ...validPatientInput, ...overrides },
  });
  if (response.statusCode !== 201) {
    throw new Error(`Failed to create patient: ${response.body}`);
  }
  return response.json().data as { patient_id: string } & Record<string, unknown>;
}

export interface TestCall {
  call_id: string;
  from_number?: string;
}

const DEFAULT_TEST_CALL: TestCall = { call_id: 'call_test_1', from_number: '+15550101234' };

async function signedRequest(url: string, body: unknown, apiKey: string) {
  const rawBody = JSON.stringify(body);
  return {
    method: 'POST' as const,
    url,
    headers: {
      'content-type': 'application/json',
      [SIGNATURE_HEADER]: await Retell.sign(rawBody, apiKey),
    },
    payload: rawBody,
  };
}

export function toolRequest(
  name: string,
  args: Record<string, unknown>,
  call: TestCall = DEFAULT_TEST_CALL,
  apiKey = TEST_RETELL_API_KEY,
) {
  return signedRequest(
    TOOLS_PATH,
    { name, args, call: { ...call, call_type: 'phone_call', direction: 'inbound' } },
    apiKey,
  );
}

export function callEventRequest(
  event: string,
  call: Record<string, unknown>,
  apiKey = TEST_RETELL_API_KEY,
) {
  return signedRequest(EVENTS_PATH, { event, call }, apiKey);
}
