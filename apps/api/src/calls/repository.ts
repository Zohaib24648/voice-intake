import type { CallRecord } from '@voice-intake/shared';
import { desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { calls, type CallRow } from '../db/schema';

export interface CallPatientLink {
  provider_call_id: string;
  patient_id: string;
  caller_phone_number: string | null;
}

export interface CallOutcome {
  provider_call_id: string;
  caller_phone_number: string | null;
  ended_reason: string | null;
  summary: string | null;
  transcript: string | null;
  started_at: Date | null;
  ended_at: Date | null;
}

export class CallRepository {
  constructor(private readonly db: Database) {}

  async linkPatient(link: CallPatientLink): Promise<void> {
    await this.db
      .insert(calls)
      .values(link)
      .onConflictDoUpdate({
        target: calls.provider_call_id,
        set: { patient_id: link.patient_id, updated_at: new Date() },
      });
  }

  async recordOutcome(outcome: CallOutcome): Promise<void> {
    const { provider_call_id, ...details } = outcome;
    await this.db
      .insert(calls)
      .values(outcome)
      .onConflictDoUpdate({
        target: calls.provider_call_id,
        set: { ...details, updated_at: new Date() },
      });
  }

  async listByPatient(patientId: string): Promise<CallRecord[]> {
    const rows = await this.db
      .select()
      .from(calls)
      .where(eq(calls.patient_id, patientId))
      .orderBy(desc(calls.created_at));

    return rows.map(toCallRecord);
  }
}

function toCallRecord(row: CallRow): CallRecord {
  return {
    ...row,
    started_at: row.started_at?.toISOString() ?? null,
    ended_at: row.ended_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
