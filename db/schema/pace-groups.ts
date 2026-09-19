import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { batches } from './batches';

export const paceGroups = pgTable(
  'pace_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    archived: boolean('archived').notNull().default(false),
    archivedAt: timestamp('archived_at'),
    size: integer('size').notNull(), // e.g. 5 / 10 / 20 / 40
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('pace_groups_batch_id_idx').on(table.batchId)],
);
