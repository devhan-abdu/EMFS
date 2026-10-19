export type TelegramConnectionErrorCode =
  | 'BATCH_NOT_FOUND'
  | 'NOT_CONNECTED'
  | 'INVALID_OR_EXPIRED_CODE'
  | 'CHAT_ALREADY_LINKED'
  | 'BATCH_ALREADY_LINKED'
  | 'NOT_A_FORUM'
  | 'PACE_GROUP_NOT_FOUND'
  | 'TOPIC_ALREADY_MAPPED'
  | 'TOPIC_NAME_MISMATCH'
  | 'PACE_GROUP_AMBIGUOUS'
  | 'TELEGRAM_API_ERROR';

export class TelegramConnectionError extends Error {
  code: TelegramConnectionErrorCode;
  constructor(code: TelegramConnectionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'TelegramConnectionError';
  }
}

/** Postgres unique_violation (23505), whether or not the driver wraps it. */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: unknown; cause?: unknown };
  if (e.code === '23505') return true;
  return e.cause !== undefined && isUniqueViolation(e.cause);
}

/** Extracts Telegram's `description` from a grammY GrammyError without importing grammY. */
export function describeTelegramError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { description?: unknown; message?: unknown };
    if (typeof e.description === 'string') return e.description;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Unknown Telegram error.';
}
