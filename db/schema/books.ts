import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  unique,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { catalogSlots } from './catalog-slots';

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    language: text('language').notNull(),
    author: text('author'),
    coverUrl: text('cover_url'),
    summary: text('summary'),
    pageCount: integer('page_count'),
    catalogSlotId: uuid('catalog_slot_id')
      .notNull()
      .references(() => catalogSlots.id, { onDelete: 'restrict' }),
    pairedBookId: uuid('paired_book_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('books_catalog_slot_language_unique').on(
      table.catalogSlotId,
      table.language,
    ),
    unique('books_id_catalog_slot_unique').on(table.id, table.catalogSlotId),
    index('books_catalog_slot_id_idx').on(table.catalogSlotId),
    index('books_language_idx').on(table.language),
    foreignKey({
      columns: [table.pairedBookId, table.catalogSlotId],
      foreignColumns: [table.id, table.catalogSlotId],
      name: 'books_paired_book_same_slot_fk',
    }),
  ],
);

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
