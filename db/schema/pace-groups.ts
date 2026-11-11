import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  index,
  boolean,
  uniqueIndex,
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
    min_pages: integer('min_pages').notNull().default(1),
    max_pages: integer('max_pages').notNull(),
    activeCatalogSlotId: uuid('active_catalog_slot_id')
      .notNull()
      .references(() => catalogSlots.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('pace_groups_batch_id_idx').on(table.batchId),
    uniqueIndex('pace_groups_batch_name_lower_unique_idx').on(
      table.batchId,
      sql`lower(btrim(${table.name}))`,
    ),
  ],
);
