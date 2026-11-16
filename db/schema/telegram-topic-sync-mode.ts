import { pgEnum } from 'drizzle-orm/pg-core';

export const TELEGRAM_TOPIC_SYNC_MODES = ['managed', 'manual'] as const;
export type TelegramTopicSyncMode = (typeof TELEGRAM_TOPIC_SYNC_MODES)[number];

export const telegramTopicSyncModeEnum = pgEnum(
  'telegram_topic_sync_mode',
  TELEGRAM_TOPIC_SYNC_MODES,
);
