'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-zinc-500">
        The patient API could not be reached. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Retry
      </button>
    </section>
  );
}
