import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { fieldErrorsFromValidation } from '../validation';
import { fail } from './envelope';
import { AppError } from './errors';

interface HttpError {
  statusCode: number;
  message: string;
}

export const errorHandling = fp(async (app) => {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const context = error.validationContext ?? 'request';
      const statusCode = context === 'body' ? 422 : 400;
      const details = fieldErrorsFromValidation(error.validation);
      return reply
        .status(statusCode)
        .send(fail('VALIDATION_ERROR', `Invalid request ${context}`, details));
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, 'Response failed schema serialization');
      return reply.status(500).send(fail('INTERNAL_ERROR', 'An unexpected error occurred'));
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(fail(error.code, error.message, error.details));
    }

    if (isClientError(error)) {
      return reply.status(error.statusCode).send(fail('BAD_REQUEST', error.message));
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send(fail('INTERNAL_ERROR', 'An unexpected error occurred'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(fail('NOT_FOUND', `Route ${request.method} ${request.url} not found`)),
  );
});

function isClientError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}
