import { BotError, GrammyError, HttpError } from 'grammy';

export function isTransientError(error: unknown): boolean {
  const err = error instanceof BotError ? error.error : error;

  if (err instanceof HttpError) return true; // network failure reaching Telegram
  if (err instanceof GrammyError) {
    return err.error_code === 429 || err.error_code >= 500;
  }
  return false;
}

export function isBadTokenError(error: unknown): boolean {
  const err = error instanceof BotError ? error.error : error;
  return err instanceof GrammyError && err.error_code === 401;
}

export function isBotRemovedError(error: unknown): boolean {
  const err = error instanceof BotError ? error.error : error;
  return (
    err instanceof GrammyError &&
    [400, 403].includes(err.error_code) &&
    /kicked|blocked|chat not found|not a member|deactivated/i.test(
      err.description,
    )
  );
}
