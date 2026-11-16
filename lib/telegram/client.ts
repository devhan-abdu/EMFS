import 'server-only';
import { Api } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import type { TelegramApiPort } from '@/lib/services/telegram/api-port';
import { toApiPort } from './api-port-adapter';

export function requireBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  return token;
}

/**
 * System-side Telegram client (posting, creating topics) that works without
 * the bot process running. Retries on 429 / transient errors.
 */
export function createTelegramApi(token: string = requireBotToken()): Api {
  const api = new Api(token);
  api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 10 }));
  return api;
}

export function getTelegramApiPort(): TelegramApiPort {
  return toApiPort(createTelegramApi());
}
