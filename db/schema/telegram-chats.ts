import {
  pgTable,
  text,
  timestamp,
  uuid,
  bigint,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { batches } from './batches';
import { profiles } from './users';

export const TELEGRAM_CHAT_STATUSES = ['active', 'bot_removed'] as const;
export type TelegramChatStatus = (typeof TELEGRAM_CHAT_STATUSES)[number];
export const telegramChatStatusEnum = pgEnum(
  'telegram_chat_status',
  TELEGRAM_CHAT_STATUSES,
);

/**
 * One Telegram supergroup per batch. Pace groups are enforced inside it
 * through forum topics (see telegram_chat_topics).
 * Supergroup ids look like -100xxxxxxxxxx, so chat_id must be bigint.
 */
export const telegramChats = pgTable('telegram_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: bigint('chat_id', { mode: 'bigint' }).notNull().unique(),
  batchId: uuid('batch_id')
    .notNull()
    .unique()
    .references(() => batches.id, { onDelete: 'cascade' }),
  title: text('title'),
  isForum: boolean('is_forum').notNull().default(false),
  status: telegramChatStatusEnum('status').notNull().default('active'),
  canManageTopics: boolean('can_manage_topics').notNull().default(false),
  linkedBy: uuid('linked_by').references(() => profiles.id, {
    onDelete: 'set null',
  }),
  linkedAt: timestamp('linked_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type TelegramChat = typeof telegramChats.$inferSelect;
export type NewTelegramChat = typeof telegramChats.$inferInsert;
