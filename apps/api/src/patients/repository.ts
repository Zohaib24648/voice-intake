import {
  mdyFromIsoDate,
  type NewPatient,
  type Patient,
  type PatientChanges,
  type PatientFilters,
} from '@voice-intake/shared';
import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client';
import { patients, type PatientRow } from '../db/schema';

export class PatientRepository {
  constructor(private readonly db: Database) {}

  async list(filters: PatientFilters): Promise<Patient[]> {
    const conditions: SQL[] = [isNull(patients.deleted_at)];
    if (filters.last_name) {
      conditions.push(sql`lower(${patients.last_name}) = lower(${filters.last_name})`);
    }
    if (filters.date_of_birth) {
      conditions.push(eq(patients.date_of_birth, filters.date_of_birth));
    }
    if (filters.phone_number) {
      conditions.push(eq(patients.phone_number, filters.phone_number));
    }

    const rows = await this.db
      .select()
      .from(patients)
      .where(and(...conditions))
      .orderBy(desc(patients.created_at));

    return rows.map(toPatient);
  }

  async findById(patientId: string): Promise<Patient | null> {
    const [row] = await this.db
      .select()
      .from(patients)
      .where(and(eq(patients.patient_id, patientId), isNull(patients.deleted_at)))
      .limit(1);

    return row ? toPatient(row) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Patient | null> {
    const [row] = await this.db
      .select()
      .from(patients)
      .where(and(eq(patients.phone_number, phoneNumber), isNull(patients.deleted_at)))
      .orderBy(desc(patients.created_at))
      .limit(1);

    return row ? toPatient(row) : null;
  }

  async create(input: NewPatient): Promise<Patient> {
    const [row] = await this.db.insert(patients).values(input).returning();
    return toPatient(row!);
  }

  async update(patientId: string, changes: PatientChanges): Promise<Patient | null> {
    const [row] = await this.db
      .update(patients)
      .set(changes)
      .where(and(eq(patients.patient_id, patientId), isNull(patients.deleted_at)))
      .returning();

    return row ? toPatient(row) : null;
  }

  async softDelete(patientId: string): Promise<Patient | null> {
    const [row] = await this.db
      .update(patients)
      .set({ deleted_at: new Date() })
      .where(and(eq(patients.patient_id, patientId), isNull(patients.deleted_at)))
      .returning();

    return row ? toPatient(row) : null;
  }
}

function toPatient(row: PatientRow): Patient {
  return {
    ...row,
    date_of_birth: mdyFromIsoDate(row.date_of_birth),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    deleted_at: row.deleted_at?.toISOString() ?? null,
  };
}
