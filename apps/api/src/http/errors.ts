import type { FieldError } from '@voice-intake/shared';

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, 'BAD_REQUEST', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(503, 'SERVICE_UNAVAILABLE', message);
  }
}

export class ValidationError extends AppError {
  constructor(details: FieldError[], message = 'Validation failed') {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}
