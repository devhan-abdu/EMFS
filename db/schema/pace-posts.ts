import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { books } from './books';
import { profiles } from './users';
import { batches } from './batches';

export const pacePosts = pgTable(
  'pace_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'restrict' }),
    paceSize: integer('pace_size').notNull(),
    bookDayNumber: integer('book_day_number').notNull(),
    version: integer('version').notNull().default(1),
    caption: text('caption').notNull(),
    captionAm: text('caption_am'),
    imageUrl: text('image_url'),
    imagePublicId: text('image_public_id'),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    sourceBatchId: uuid('source_batch_id').references(() => batches.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('pace_posts_book_pace_day_version_unique').on(
      table.bookId,
      table.paceSize,
      table.bookDayNumber,
      table.version,
    ),
    index('pace_posts_lookup_idx').on(
      table.bookId,
      table.paceSize,
      table.bookDayNumber,
    ),
    check(
      'pace_posts_pace_size_check',
      sql`${table.paceSize} IN (5, 10, 20, 40)`,
    ),
  ],
);

export type PacePost = typeof pacePosts.$inferSelect;
export type NewPacePost = typeof pacePosts.$inferInsert;
