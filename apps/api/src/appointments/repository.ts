import type { Appointment } from '@voice-intake/shared';
import { asc, eq, gte } from 'drizzle-orm';
import type { Database } from '../db/client';
import { appointments, type AppointmentRow } from '../db/schema';

export interface NewAppointmentRecord {
  patient_id: string;
  scheduled_at: Date;
  reason: string | null;
}

export class AppointmentRepository {
  constructor(private readonly db: Database) {}

  async listBookedTimesFrom(from: Date): Promise<Date[]> {
    const rows = await this.db
      .select({ scheduled_at: appointments.scheduled_at })
      .from(appointments)
      .where(gte(appointments.scheduled_at, from));

    return rows.map((row) => row.scheduled_at);
  }

  async create(record: NewAppointmentRecord): Promise<Appointment> {
    const [row] = await this.db.insert(appointments).values(record).returning();
    return toAppointment(row!);
  }

  async listByPatient(patientId: string): Promise<Appointment[]> {
    const rows = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.patient_id, patientId))
      .orderBy(asc(appointments.scheduled_at));

    return rows.map(toAppointment);
  }
}

function toAppointment(row: AppointmentRow): Appointment {
  return {
    ...row,
    scheduled_at: row.scheduled_at.toISOString(),
    created_at: row.created_at.toISOString(),
  };
}
