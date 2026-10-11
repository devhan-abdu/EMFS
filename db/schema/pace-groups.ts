import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  index,
  boolean,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { batches } from './batches';
import { catalogSlots } from './catalog-slots';

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
    min_pages: integer('min_pages').notNull().default(1), // minimum pages per day
    max_pages: integer('max_pages').notNull(), // maximum pages per day
    activeCatalogSlotId: uuid('active_catalog_slot_id')
      .notNull()
      .references(() => catalogSlots.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('pace_groups_batch_id_idx').on(table.batchId),
    check('pace_groups_min_pages_check', sql`${table.min_pages} >= 1`),
    check(
      'pace_groups_max_pages_check',
      sql`${table.max_pages} >= ${table.min_pages}`,
    ),
  ],
);
