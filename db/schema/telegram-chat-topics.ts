import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  pgEnum,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { paceGroups } from './pace-groups';
import { telegramChats } from './telegram-chats';

export const TELEGRAM_TOPIC_KINDS = ['pace_group', 'announcement'] as const;
export type TelegramTopicKind = (typeof TELEGRAM_TOPIC_KINDS)[number];
export const telegramTopicKindEnum = pgEnum(
  'telegram_topic_kind',
  TELEGRAM_TOPIC_KINDS,
);

/**
 * Maps a forum topic (message_thread_id) of a linked group to its purpose.
 * A pace_group topic is the only place that pace group's members are expected to
 * use Done / attendance / reflection; the system enforces membership, not Telegram.
 */
export const telegramChatTopics = pgTable(
  'telegram_chat_topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    telegramChatId: uuid('telegram_chat_id')
      .notNull()
      .references(() => telegramChats.id, { onDelete: 'cascade' }),
    messageThreadId: integer('message_thread_id').notNull(),
    kind: telegramTopicKindEnum('kind').notNull(),
    paceGroupId: uuid('pace_group_id')
      .unique()
      .references(() => paceGroups.id, { onDelete: 'cascade' }),
    name: text('name'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('telegram_chat_topics_chat_thread_idx').on(
      table.telegramChatId,
      table.messageThreadId,
    ),
    // At most one announcement topic per chat.
    uniqueIndex('telegram_chat_topics_one_announcement_idx')
      .on(table.telegramChatId)
      .where(sql`${table.kind} = 'announcement'`),
    check(
      'telegram_chat_topics_kind_pace_group_check',
      sql`(${table.kind} = 'pace_group') = (${table.paceGroupId} IS NOT NULL)`,
    ),
  ],
);

export type TelegramChatTopic = typeof telegramChatTopics.$inferSelect;
export type NewTelegramChatTopic = typeof telegramChatTopics.$inferInsert;
