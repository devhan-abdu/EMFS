import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { books } from './books';

export const bookChapters = pgTable(
  'book_chapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    startPage: integer('start_page').notNull(),
    endPage: integer('end_page').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('book_chapters_book_id_start_page_idx').on(
      table.bookId,
      table.startPage,
    ),
    check('book_chapters_start_page_check', sql`${table.startPage} >= 1`),
    check(
      'book_chapters_page_range_check',
      sql`${table.endPage} >= ${table.startPage}`,
    ),
  ],
);

export type BookChapter = typeof bookChapters.$inferSelect;
export type NewBookChapter = typeof bookChapters.$inferInsert;
