import type { Transformer } from 'grammy';

declare module '@grammyjs/auto-retry' {
  export function autoRetry(options?: {
    maxRetryAttempts?: number;
    maxDelaySeconds?: number;
    rethrowInternalError?: boolean;
    rethrowHttpError?: boolean;
  }): Transformer;
}
