import Link from 'next/link';
import type { PatientListFilters } from '@/lib/api';

const inputClass =
  'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900';

export function SearchForm({ filters }: { filters: PatientListFilters }) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="last_name"
        placeholder="Last name"
        defaultValue={filters.last_name ?? ''}
        className={inputClass}
      />
      <input
        type="search"
        name="phone_number"
        placeholder="Phone number"
        defaultValue={filters.phone_number ?? ''}
        className={inputClass}
      />
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Search
      </button>
      {(filters.last_name || filters.phone_number) && (
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
