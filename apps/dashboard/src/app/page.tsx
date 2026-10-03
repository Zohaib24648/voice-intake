import type { Patient } from '@voice-intake/shared';
import { PatientsTable } from '@/components/patients-table';
import { SearchForm } from '@/components/search-form';
import { api, ApiRequestError, type PatientListFilters } from '@/lib/api';

interface PatientsPageProps {
  searchParams: Promise<PatientListFilters>;
}

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const filters = await searchParams;
  const { patients, filterError } = await loadPatients(filters);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="text-sm text-zinc-500">
            {patients.length} {patients.length === 1 ? 'record' : 'records'}
            {hasFilters(filters) ? ' matching your search' : ' registered'}
          </p>
        </div>
        <SearchForm filters={filters} />
      </div>

      {filterError && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          {filterError}
        </p>
      )}

      <PatientsTable patients={patients} />
    </section>
  );
}

async function loadPatients(
  filters: PatientListFilters,
): Promise<{ patients: Patient[]; filterError: string | null }> {
  try {
    return { patients: await api.listPatients(filters), filterError: null };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 400) {
      return { patients: [], filterError: `The search could not be applied: ${error.message}.` };
    }
    throw error;
  }
}

function hasFilters(filters: PatientListFilters): boolean {
  return Boolean(filters.last_name || filters.phone_number);
}
