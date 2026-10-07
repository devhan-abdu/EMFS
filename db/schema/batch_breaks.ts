import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { batches } from './batches';
import { paceGroups } from './pace-groups';
import { profiles } from './users';

export const batchBreaks = pgTable(
  'batch_breaks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    paceGroupId: uuid('pace_group_id').references(() => paceGroups.id, {
      onDelete: 'cascade',
    }),

    title: text('title').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('batch_breaks_batch_id_idx').on(table.batchId),
    index('batch_breaks_date_range_idx').on(table.startDate, table.endDate),
  ],
);
