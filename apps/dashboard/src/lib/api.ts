import type { ApiResponse, Appointment, CallRecord, Patient } from '@voice-intake/shared';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface PatientListFilters {
  last_name?: string;
  phone_number?: string;
}

function baseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error('API_BASE_URL is not configured');
  return url.replace(/\/$/, '');
}

export function apiDocsUrl(): string {
  return `${baseUrl()}/docs`;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, { cache: 'no-store' });
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || body.error) {
    throw new ApiRequestError(response.status, body.error?.message ?? response.statusText);
  }
  return body.data;
}

export const api = {
  listPatients(filters: PatientListFilters): Promise<Patient[]> {
    const query = new URLSearchParams();
    if (filters.last_name) query.set('last_name', filters.last_name);
    if (filters.phone_number) query.set('phone_number', filters.phone_number);
    const suffix = query.size > 0 ? `?${query}` : '';
    return request<Patient[]>(`/patients${suffix}`);
  },

  getPatient(patientId: string): Promise<Patient> {
    return request<Patient>(`/patients/${encodeURIComponent(patientId)}`);
  },

  listCalls(patientId: string): Promise<CallRecord[]> {
    return request<CallRecord[]>(`/patients/${encodeURIComponent(patientId)}/calls`);
  },

  listAppointments(patientId: string): Promise<Appointment[]> {
    return request<Appointment[]>(`/patients/${encodeURIComponent(patientId)}/appointments`);
  },
};
