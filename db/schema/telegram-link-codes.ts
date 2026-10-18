import {
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { batches } from './batches';
import { profiles } from './users';

/**
 * Short-lived, single-use codes an admin sends as `/link CODE` inside a
 * Telegram group so the bot can bind that group to a batch.
 */
export const telegramLinkCodes = pgTable(
  'telegram_link_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('telegram_link_codes_code_idx').on(table.code),
    index('telegram_link_codes_batch_idx').on(table.batchId),
  ],
);

export type TelegramLinkCode = typeof telegramLinkCodes.$inferSelect;
export type NewTelegramLinkCode = typeof telegramLinkCodes.$inferInsert;
