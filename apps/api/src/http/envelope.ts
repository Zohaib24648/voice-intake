import type { ApiFailure, ApiSuccess, FieldError } from '@voice-intake/shared';
import { z } from 'zod';

export function ok<T>(data: T): ApiSuccess<T> {
  return { data, error: null };
}

export function fail(code: string, message: string, details?: FieldError[]): ApiFailure {
  return { data: null, error: details ? { code, message, details } : { code, message } };
}

const errorEnvelopeSchema = z.object({
  data: z.null(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

function successEnvelopeSchema<T extends z.ZodType>(data: T) {
  return z.object({ data, error: z.null() });
}

export function responseSchemas<T extends z.ZodType>(successStatus: 200 | 201, data: T) {
  return {
    [successStatus]: successEnvelopeSchema(data),
    '4xx': errorEnvelopeSchema,
    '5xx': errorEnvelopeSchema,
  };
}
