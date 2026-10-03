import { z } from 'zod';

export const callRecordSchema = z.object({
  call_id: z.uuid(),
  provider_call_id: z.string(),
  patient_id: z.uuid().nullable(),
  caller_phone_number: z.string().nullable(),
  ended_reason: z.string().nullable(),
  summary: z.string().nullable(),
  transcript: z.string().nullable(),
  started_at: z.iso.datetime().nullable(),
  ended_at: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export type CallRecord = z.infer<typeof callRecordSchema>;
