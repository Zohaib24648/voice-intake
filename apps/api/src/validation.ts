import type { FieldError } from '@voice-intake/shared';
import type { ZodFastifySchemaValidationError } from 'fastify-type-provider-zod';
import type { z } from 'zod';

const UNRECOGNIZED_FIELD = 'Unrecognized field';
const ROOT_FIELD = '(root)';

export function fieldErrorsFromIssues(issues: z.core.$ZodIssue[]): FieldError[] {
  return issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ field: key, message: UNRECOGNIZED_FIELD }));
    }
    return [{ field: issue.path.map(String).join('.') || ROOT_FIELD, message: issue.message }];
  });
}

export function fieldErrorsFromValidation(
  validation: ZodFastifySchemaValidationError[],
): FieldError[] {
  return validation.flatMap((entry) => {
    if (entry.keyword === 'unrecognized_keys') {
      const keys = (entry.params as { keys?: string[] }).keys ?? [];
      return keys.map((key) => ({ field: key, message: UNRECOGNIZED_FIELD }));
    }
    const field = entry.instancePath.split('/').filter(Boolean).join('.') || ROOT_FIELD;
    return [{ field, message: entry.message ?? 'Invalid value' }];
  });
}
