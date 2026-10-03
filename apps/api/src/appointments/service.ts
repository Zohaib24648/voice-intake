import {
  CLINIC_TIME_ZONE,
  type Appointment,
  type AppointmentSlot,
  type NewAppointment,
} from '@voice-intake/shared';
import { TZDate } from '@date-fns/tz';
import { addDays, format, isWeekend, startOfDay } from 'date-fns';
import { ConflictError, ValidationError } from '../http/errors';
import { isUniqueViolation } from '../db/errors';
import type { AppointmentRepository } from './repository';

const CLINIC_TIME_ZONE_LABEL = 'Eastern';
const DAILY_SLOT_TIMES = [
  { hours: 9, minutes: 0 },
  { hours: 10, minutes: 30 },
  { hours: 13, minutes: 0 },
  { hours: 14, minutes: 30 },
  { hours: 16, minutes: 0 },
];
const BUSINESS_DAYS_TO_OFFER = 5;
const MAX_SLOTS_TO_OFFER = 6;

export class AppointmentService {
  constructor(private readonly repository: AppointmentRepository) {}

  async availableSlots(now: Date = new Date()): Promise<AppointmentSlot[]> {
    const booked = new Set(
      (await this.repository.listBookedTimesFrom(now)).map((time) => time.getTime()),
    );

    return upcomingClinicSlots(now)
      .filter((slot) => !booked.has(slot.getTime()))
      .slice(0, MAX_SLOTS_TO_OFFER)
      .map((slot) => ({ scheduled_at: slot.toISOString(), label: describeSlot(slot) }));
  }

  async book(patientId: string, input: NewAppointment): Promise<Appointment> {
    const scheduledAt = new Date(input.scheduled_at);
    if (scheduledAt.getTime() <= Date.now()) {
      throw new ValidationError([
        { field: 'scheduled_at', message: 'Appointments must be scheduled in the future' },
      ]);
    }

    try {
      return await this.repository.create({
        patient_id: patientId,
        scheduled_at: scheduledAt,
        reason: input.reason ?? null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('That appointment time is no longer available');
      }
      throw error;
    }
  }

  listByPatient(patientId: string): Promise<Appointment[]> {
    return this.repository.listByPatient(patientId);
  }
}

export function describeSlot(slot: Date): string {
  const local = new TZDate(slot, CLINIC_TIME_ZONE);
  return `${format(local, "EEEE, MMMM d 'at' h:mm a")} ${CLINIC_TIME_ZONE_LABEL}`;
}

function upcomingClinicSlots(now: Date): Date[] {
  const slots: Date[] = [];
  let day = startOfDay(addDays(new TZDate(now, CLINIC_TIME_ZONE), 1));

  while (slots.length < BUSINESS_DAYS_TO_OFFER * DAILY_SLOT_TIMES.length) {
    if (!isWeekend(day)) {
      for (const { hours, minutes } of DAILY_SLOT_TIMES) {
        const local = new TZDate(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          hours,
          minutes,
          CLINIC_TIME_ZONE,
        );
        slots.push(new Date(local.getTime()));
      }
    }
    day = addDays(day, 1);
  }

  return slots;
}
