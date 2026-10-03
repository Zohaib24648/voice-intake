import { SEX_LABELS, type Patient } from '@voice-intake/shared';
import Link from 'next/link';
import { formatDate, formatPhone } from '@/lib/format';

const headerClass = 'px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500';
const cellClass = 'px-4 py-3 align-top';

export function PatientsTable({ patients }: { patients: Patient[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className={headerClass}>Name</th>
            <th className={headerClass}>Date of birth</th>
            <th className={headerClass}>Sex</th>
            <th className={headerClass}>Phone</th>
            <th className={headerClass}>Location</th>
            <th className={headerClass}>Registered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {patients.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                No patients to show.
              </td>
            </tr>
          )}
          {patients.map((patient) => (
            <tr key={patient.patient_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <td className={cellClass}>
                <Link
                  href={`/patients/${patient.patient_id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {patient.last_name}, {patient.first_name}
                </Link>
              </td>
              <td className={cellClass}>{patient.date_of_birth}</td>
              <td className={cellClass}>{SEX_LABELS[patient.sex]}</td>
              <td className={`${cellClass} tabular-nums`}>{formatPhone(patient.phone_number)}</td>
              <td className={cellClass}>
                {patient.city}, {patient.state}
              </td>
              <td className={cellClass}>{formatDate(patient.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
