import type { CallRecord } from '@voice-intake/shared';
import { formatDateTime, orDash } from '@/lib/format';

export function CallList({ calls }: { calls: CallRecord[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Voice calls</h2>
      {calls.length === 0 ? (
        <p className="text-sm text-zinc-500">No calls linked to this record.</p>
      ) : (
        <ul className="space-y-3">
          {calls.map((call) => (
            <li
              key={call.call_id}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">
                  {formatDateTime(call.started_at ?? call.created_at)}
                </span>
                <span className="text-zinc-500">{orDash(call.ended_reason)}</span>
              </div>
              <p className="mt-2">{orDash(call.summary)}</p>
              {call.transcript && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-zinc-500">Transcript</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 font-sans text-xs leading-relaxed dark:bg-zinc-950">
                    {call.transcript}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
