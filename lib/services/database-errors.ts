export function isUniqueConstraintViolation(
  error: unknown,
  constraintName: string,
): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const dbError = error as {
    code?: unknown;
    constraint?: unknown;
    constraint_name?: unknown;
    message?: unknown;
    cause?: unknown;
  };

  if (
    dbError.code === '23505' &&
    (dbError.constraint === constraintName ||
      dbError.constraint_name === constraintName ||
      (typeof dbError.message === 'string' &&
        dbError.message.includes(constraintName)))
  ) {
    return true;
  }

  return dbError.cause !== undefined
    ? isUniqueConstraintViolation(dbError.cause, constraintName)
    : false;
}
