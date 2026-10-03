import { z } from 'zod';

const callSchema = z.object({
  call_id: z.string(),
  call_type: z.string().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  from_number: z.string().optional(),
  to_number: z.string().optional(),
  start_timestamp: z.number().optional(),
  end_timestamp: z.number().optional(),
  disconnection_reason: z.string().optional(),
  transcript: z.string().optional(),
  call_analysis: z.object({ call_summary: z.string().optional() }).optional(),
});

export const customFunctionRequestSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()).default({}),
  call: callSchema.optional(),
});

export const callEventSchema = z.object({
  event: z.string(),
  call: callSchema,
});

export const HANDLED_CALL_EVENTS = new Set<string>(['call_started', 'call_ended', 'call_analyzed']);

export type RetellCall = z.infer<typeof callSchema>;
export type CustomFunctionRequest = z.infer<typeof customFunctionRequestSchema>;
export type CallEvent = z.infer<typeof callEventSchema>;
