const MDY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function isoDateFromMdy(input: string): string | null {
  const match = MDY_PATTERN.exec(input);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  const candidate = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDate =
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day;

  return isRealCalendarDate ? candidate.toISOString().slice(0, 10) : null;
}

export function mdyFromIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
