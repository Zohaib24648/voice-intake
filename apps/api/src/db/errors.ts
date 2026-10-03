const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  return postgresErrorCode(error) === UNIQUE_VIOLATION;
}

// Drizzle wraps driver errors, so the SQLSTATE code may sit on `cause`.
function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  if ('cause' in error) return postgresErrorCode(error.cause);
  return undefined;
}
