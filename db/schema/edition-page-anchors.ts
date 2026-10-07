import {
  pgTable,
  timestamp,
  integer,
  uuid,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { books } from './books';

export const editionPageAnchors = pgTable(
  'edition_page_anchors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionBookId: uuid('edition_book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'restrict' }),
    programPage: integer('program_page').notNull(),
    editionPage: integer('edition_page').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('edition_page_anchors_edition_program_page_unique').on(
      table.editionBookId,
      table.programPage,
    ),
    index('edition_page_anchors_edition_book_id_idx').on(table.editionBookId),
    check(
      'edition_page_anchors_program_page_check',
      sql`${table.programPage} >= 1`,
    ),
    check(
      'edition_page_anchors_edition_page_check',
      sql`${table.editionPage} >= 1`,
    ),
  ],
);

export type EditionPageAnchor = typeof editionPageAnchors.$inferSelect;
export type NewEditionPageAnchor = typeof editionPageAnchors.$inferInsert;
