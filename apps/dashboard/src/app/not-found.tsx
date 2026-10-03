import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Patient not found</h1>
      <p className="text-sm text-zinc-500">
        There is no active patient record at this address. It may have been removed.
      </p>
      <Link href="/" className="text-sm underline">
        Back to all patients
      </Link>
    </section>
  );
}
