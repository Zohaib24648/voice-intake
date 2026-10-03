import type { Appointment } from '@voice-intake/shared';
import { formatDateTime, orDash } from '@/lib/format';

export function AppointmentList({ appointments }: { appointments: Appointment[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Appointments</h2>
      {appointments.length === 0 ? (
        <p className="text-sm text-zinc-500">No appointments booked.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {appointments.map((appointment) => (
            <li
              key={appointment.appointment_id}
              className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
            >
              <span className="font-medium">{formatDateTime(appointment.scheduled_at)}</span>
              <span className="text-zinc-500">{orDash(appointment.reason)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
