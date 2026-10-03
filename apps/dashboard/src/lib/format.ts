import { CLINIC_TIME_ZONE, formatUsPhoneNumber } from '@voice-intake/shared';

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: CLINIC_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: CLINIC_TIME_ZONE,
});

export function formatDateTime(iso: string | null): string {
  return iso ? `${dateTimeFormatter.format(new Date(iso))} ET` : '—';
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatPhone(digits: string | null): string {
  return digits ? formatUsPhoneNumber(digits) : '—';
}

export function orDash(value: string | null | undefined): string {
  return value && value.trim() ? value : '—';
}
