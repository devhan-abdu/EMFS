import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  date,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './users';
import { telegramTopicSyncModeEnum } from './telegram-topic-sync-mode';

export const batches = pgTable(
  'batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    maxMembers: integer('max_members').notNull(),
    paceGroupCount: integer('pace_group_count').notNull().default(1),
    registrationOpen: boolean('registration_open').notNull().default(false),
    autoApprove: boolean('auto_approve').notNull().default(true),
    startDate: date('start_date'),
    readingDaysPerWeek: integer('reading_days_per_week').notNull().default(6),
    telegramTopicSyncMode: telegramTopicSyncModeEnum('telegram_topic_sync_mode')
      .notNull()
      .default('manual'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('batches_name_lower_unique_idx').on(
      sql`lower(btrim(${table.name}))`,
    ),
  ],
);
