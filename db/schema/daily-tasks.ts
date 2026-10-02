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
import { curriculumSteps } from './curriculum-steps';
import { profiles } from './users';

export const TASK_PUBLICATION_STATUS = ['draft', 'published'] as const;

export type TaskPublicationStatus = (typeof TASK_PUBLICATION_STATUS)[number];

export const taskPublicationStatusEnum = pgEnum(
  'task_publication_status',
  TASK_PUBLICATION_STATUS,
);

export const batchDailyTasks = pgTable(
  'batch_daily_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paceGroupId: uuid('pace_group_id')
      .notNull()
      .references(() => paceGroups.id, { onDelete: 'cascade' }),
    curriculumStepId: uuid('curriculum_step_id')
      .notNull()
      .references(() => curriculumSteps.id, { onDelete: 'restrict' }),
    scheduledDate: date('scheduled_date').notNull(),
    batchDayNumber: integer('batch_day_number').notNull(),
    localCaptionOverride: text('local_caption_override'),
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
    unique('batch_daily_tasks_group_date_unique').on(
      table.paceGroupId,
      table.scheduledDate,
    ),
    unique('batch_daily_tasks_group_day_unique').on(
      table.paceGroupId,
      table.batchDayNumber,
    ),
    unique('batch_daily_tasks_group_step_unique').on(
      table.paceGroupId,
      table.curriculumStepId,
    ),
    index('batch_daily_tasks_curriculum_step_id_idx').on(
      table.curriculumStepId,
    ),
    index('batch_daily_tasks_publication_status_idx').on(
      table.publicationStatus,
    ),
    check(
      'batch_daily_tasks_publication_check',
      sql`(${table.publicationStatus} = 'published') = (${table.publishedAt} IS NOT NULL)`,
    ),
    check(
      'batch_daily_tasks_day_number_check',
      sql`${table.batchDayNumber} > 0`,
    ),
  ],
);

export type BatchDailyTask = typeof batchDailyTasks.$inferSelect;
export type NewBatchDailyTask = typeof batchDailyTasks.$inferInsert;
