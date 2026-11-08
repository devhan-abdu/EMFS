import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { telegramChats } from './telegram-chats';

export const telegramTopicDiscoveries = pgTable(
  'telegram_topic_discoveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    telegramChatId: uuid('telegram_chat_id')
      .notNull()
      .references(() => telegramChats.id, {
        onDelete: 'cascade',
      }),

    messageThreadId: integer('message_thread_id').notNull(),

    topicName: text('topic_name'),

    discoveredAt: timestamp('discovered_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('telegram_topic_discoveries_chat_thread_idx').on(
      table.telegramChatId,
      table.messageThreadId,
    ),
  ],
);

export type TelegramTopicDiscovery =
  typeof telegramTopicDiscoveries.$inferSelect;

export type NewTelegramTopicDiscovery =
  typeof telegramTopicDiscoveries.$inferInsert;
