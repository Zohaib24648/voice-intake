import { SEX_LABELS, type Patient } from '@voice-intake/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppointmentList } from '@/components/appointment-list';
import { CallList } from '@/components/call-list';
import { FieldList } from '@/components/field-list';
import { api, ApiRequestError } from '@/lib/api';
import { formatDateTime, formatPhone, orDash } from '@/lib/format';

interface PatientDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: PatientDetailPageProps) {
  const { id } = await params;
  const patient = await loadPatient(id);
  const [calls, appointments] = await Promise.all([api.listCalls(id), api.listAppointments(id)]);

  return (
    <article className="space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← All patients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {patient.first_name} {patient.last_name}
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{patient.patient_id}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <FieldList
          title="Identity"
          fields={[
            ['Date of birth', patient.date_of_birth],
            ['Sex', SEX_LABELS[patient.sex]],
            ['Preferred language', patient.preferred_language],
          ]}
        />
        <FieldList
          title="Contact"
          fields={[
            ['Phone', formatPhone(patient.phone_number)],
            ['Email', orDash(patient.email)],
          ]}
        />
        <FieldList
          title="Address"
          fields={[
            ['Street', patient.address_line_1],
            ['Apt / Suite', orDash(patient.address_line_2)],
            ['City', patient.city],
            ['State', patient.state],
            ['ZIP', patient.zip_code],
          ]}
        />
        <FieldList
          title="Insurance"
          fields={[
            ['Provider', orDash(patient.insurance_provider)],
            ['Member ID', orDash(patient.insurance_member_id)],
          ]}
        />
        <FieldList
          title="Emergency contact"
          fields={[
            ['Name', orDash(patient.emergency_contact_name)],
            ['Phone', formatPhone(patient.emergency_contact_phone)],
          ]}
        />
        <FieldList
          title="Record"
          fields={[
            ['Created', formatDateTime(patient.created_at)],
            ['Updated', formatDateTime(patient.updated_at)],
          ]}
        />
      </div>

      <AppointmentList appointments={appointments} />
      <CallList calls={calls} />
    </article>
  );
}

async function loadPatient(id: string): Promise<Patient> {
  try {
    return await api.getPatient(id);
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }
}
