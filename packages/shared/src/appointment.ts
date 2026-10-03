import { z } from 'zod';

export const CLINIC_TIME_ZONE = 'America/New_York';

export const appointmentSchema = z.object({
  appointment_id: z.uuid(),
  patient_id: z.uuid(),
  scheduled_at: z.iso.datetime(),
  reason: z.string().nullable(),
  created_at: z.iso.datetime(),
});

export const appointmentSlotSchema = z.object({
  scheduled_at: z.iso.datetime(),
  label: z.string(),
});

export const bookAppointmentSchema = z.strictObject({
  scheduled_at: z.iso.datetime({
    offset: true,
    message: 'scheduled_at must be an ISO 8601 date-time',
  }),
  reason: z.string().trim().min(1).max(200).nullish(),
});

export type Appointment = z.infer<typeof appointmentSchema>;
export type AppointmentSlot = z.infer<typeof appointmentSlotSchema>;
export type BookAppointmentInput = z.input<typeof bookAppointmentSchema>;
export type NewAppointment = z.output<typeof bookAppointmentSchema>;
