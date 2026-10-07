import {
  pgTable,
  integer,
  uuid,
  unique,
  index,
  check,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const catalogSlots = pgTable(
  'catalog_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequenceOrder: integer('sequence_order').notNull(),
    archived: boolean('archived').notNull().default(false),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('catalog_slots_sequence_order_unique').on(table.sequenceOrder),
    index('catalog_slots_archived_idx').on(table.archived),
    check(
      'catalog_slots_sequence_order_check',
      sql`${table.sequenceOrder} > 0`,
    ),
  ],
);

export type CatalogSlot = typeof catalogSlots.$inferSelect;
export type NewCatalogSlot = typeof catalogSlots.$inferInsert;
