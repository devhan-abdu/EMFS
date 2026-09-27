import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  date,
  pgEnum,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { paceGroups } from './pace-groups';
import { books } from './books';
import { pacePosts } from './pace-posts';
import { profiles } from './users';

export const TASK_PUBLICATION_STATUS = ['draft', 'published'] as const;

export type TaskPublicationStatus = (typeof TASK_PUBLICATION_STATUS)[number];

export const taskPublicationStatusEnum = pgEnum(
  'task_publication_status',
  TASK_PUBLICATION_STATUS,
);

export const dailyTasks = pgTable(
  'daily_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paceGroupId: uuid('pace_group_id')
      .notNull()
      .references(() => paceGroups.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'restrict' }),
    dayNumber: integer('day_number').notNull(),
    bookDayNumber: integer('book_day_number').notNull(),
    scheduledDate: date('scheduled_date').notNull(),
    paceSize: integer('pace_size').notNull(),
    startPage: integer('start_page').notNull(),
    endPage: integer('end_page').notNull(),
    pairedBookId: uuid('paired_book_id').references(() => books.id, {
      onDelete: 'set null',
    }),
    pairedStartPage: integer('paired_start_page'),
    pairedEndPage: integer('paired_end_page'),
    content: text('content').notNull(),
    pacePostId: uuid('pace_post_id').references(() => pacePosts.id, {
      onDelete: 'set null',
    }),
    publicationStatus: taskPublicationStatusEnum('publication_status')
      .notNull()
      .default('draft'),
    publishedAt: timestamp('published_at'),
    publishedBy: uuid('published_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('daily_tasks_pace_group_day_unique').on(
      table.paceGroupId,
      table.dayNumber,
    ),
    unique('daily_tasks_pace_group_scheduled_date_unique').on(
      table.paceGroupId,
      table.scheduledDate,
    ),
    unique('daily_tasks_pace_group_book_page_unique').on(
      table.paceGroupId,
      table.bookId,
      table.startPage,
      table.endPage,
    ),
    index('daily_tasks_pace_group_id_idx').on(table.paceGroupId),
    index('daily_tasks_book_id_idx').on(table.bookId),
    index('daily_tasks_publication_status_idx').on(table.publicationStatus),
    index('daily_tasks_day_number_idx').on(table.dayNumber),
    index('daily_tasks_scheduled_date_idx').on(table.scheduledDate),
    index('daily_tasks_pace_post_id_idx').on(table.pacePostId),
    index('daily_tasks_paired_book_id_idx').on(table.pairedBookId),
    check(
      'daily_tasks_publication_check',
      sql`(${table.publicationStatus} = 'published') = (${table.publishedAt} IS NOT NULL)`,
    ),
    check(
      'daily_tasks_pace_size_check',
      sql`${table.paceSize} IN (5, 10, 20, 40)`,
    ),
  ],
);

export type DailyTask = typeof dailyTasks.$inferSelect;
export type NewDailyTask = typeof dailyTasks.$inferInsert;
