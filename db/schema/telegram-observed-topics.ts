import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { telegramChats } from './telegram-chats';

/**
 * Where the bot read a topic's name from. The Bot API cannot list topics, so the
 * bot learns names from what it sees:
 *   edited  - a rename the bot saw (current name, most reliable)
 *   created - the creation service message the bot saw
 *   reply   - the topic root attached to an ordinary message (name at creation time)
 */
export const TELEGRAM_TOPIC_NAME_SOURCES = [
  'reply',
  'created',
  'edited',
] as const;
export type TelegramTopicNameSource =
  (typeof TELEGRAM_TOPIC_NAME_SOURCES)[number];
export const telegramTopicNameSourceEnum = pgEnum(
  'telegram_topic_name_source',
  TELEGRAM_TOPIC_NAME_SOURCES,
);

export const telegramObservedTopics = pgTable(
  'telegram_observed_topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    telegramChatId: uuid('telegram_chat_id')
      .notNull()
      .references(() => telegramChats.id, { onDelete: 'cascade' }),
    messageThreadId: integer('message_thread_id').notNull(),
    name: text('name').notNull(),
    nameSource: telegramTopicNameSourceEnum('name_source').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('telegram_observed_topics_chat_thread_idx').on(
      table.telegramChatId,
      table.messageThreadId,
    ),
  ],
);

export type TelegramObservedTopic = typeof telegramObservedTopics.$inferSelect;
export type NewTelegramObservedTopic =
  typeof telegramObservedTopics.$inferInsert;
