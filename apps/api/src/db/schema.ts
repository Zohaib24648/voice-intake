import { DEFAULT_PREFERRED_LANGUAGE, SEX_VALUES } from '@voice-intake/shared';
import { sql } from 'drizzle-orm';
import {
  char,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const sexEnum = pgEnum('sex', SEX_VALUES);

const auditTimestamps = {
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const patients = pgTable(
  'patients',
  {
    patient_id: uuid('patient_id').primaryKey().defaultRandom(),
    first_name: varchar('first_name', { length: 50 }).notNull(),
    last_name: varchar('last_name', { length: 50 }).notNull(),
    date_of_birth: date('date_of_birth', { mode: 'string' }).notNull(),
    sex: sexEnum('sex').notNull(),
    phone_number: char('phone_number', { length: 10 }).notNull(),
    email: varchar('email', { length: 254 }),
    address_line_1: varchar('address_line_1', { length: 200 }).notNull(),
    address_line_2: varchar('address_line_2', { length: 200 }),
    city: varchar('city', { length: 100 }).notNull(),
    state: char('state', { length: 2 }).notNull(),
    zip_code: varchar('zip_code', { length: 10 }).notNull(),
    insurance_provider: varchar('insurance_provider', { length: 100 }),
    insurance_member_id: varchar('insurance_member_id', { length: 50 }),
    preferred_language: varchar('preferred_language', { length: 50 })
      .notNull()
      .default(DEFAULT_PREFERRED_LANGUAGE),
    emergency_contact_name: varchar('emergency_contact_name', { length: 100 }),
    emergency_contact_phone: char('emergency_contact_phone', { length: 10 }),
    ...auditTimestamps,
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('patients_phone_number_idx').on(table.phone_number),
    index('patients_last_name_idx').on(table.last_name),
    index('patients_date_of_birth_idx').on(table.date_of_birth),
    check('patients_first_name_not_blank', sql`char_length(${table.first_name}) >= 1`),
    check('patients_last_name_not_blank', sql`char_length(${table.last_name}) >= 1`),
    check(
      'patients_date_of_birth_range',
      sql`${table.date_of_birth} between date '1900-01-01' and current_date`,
    ),
    check('patients_phone_number_digits', sql`${table.phone_number} ~ '^[0-9]{10}$'`),
    check(
      'patients_emergency_contact_phone_digits',
      sql`${table.emergency_contact_phone} is null or ${table.emergency_contact_phone} ~ '^[0-9]{10}$'`,
    ),
    check('patients_state_code', sql`${table.state} ~ '^[A-Z]{2}$'`),
    check('patients_zip_code_format', sql`${table.zip_code} ~ '^[0-9]{5}(-[0-9]{4})?$'`),
    check('patients_city_not_blank', sql`char_length(${table.city}) >= 1`),
  ],
);

export const calls = pgTable(
  'calls',
  {
    call_id: uuid('call_id').primaryKey().defaultRandom(),
    provider_call_id: varchar('provider_call_id', { length: 64 }).notNull().unique(),
    patient_id: uuid('patient_id').references(() => patients.patient_id, {
      onDelete: 'set null',
    }),
    caller_phone_number: varchar('caller_phone_number', { length: 20 }),
    ended_reason: varchar('ended_reason', { length: 120 }),
    summary: text('summary'),
    transcript: text('transcript'),
    started_at: timestamp('started_at', { withTimezone: true }),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    ...auditTimestamps,
  },
  (table) => [index('calls_patient_id_idx').on(table.patient_id)],
);

export const appointments = pgTable(
  'appointments',
  {
    appointment_id: uuid('appointment_id').primaryKey().defaultRandom(),
    patient_id: uuid('patient_id')
      .notNull()
      .references(() => patients.patient_id),
    scheduled_at: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    reason: varchar('reason', { length: 200 }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('appointments_patient_id_idx').on(table.patient_id),
    uniqueIndex('appointments_scheduled_at_unique').on(table.scheduled_at),
  ],
);

export type PatientRow = typeof patients.$inferSelect;
export type CallRow = typeof calls.$inferSelect;
export type AppointmentRow = typeof appointments.$inferSelect;
