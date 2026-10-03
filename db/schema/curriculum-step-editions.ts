import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  unique,
  index,
  check,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { books } from './books';
import { curriculumSteps } from './curriculum-steps';

export const curriculumStepEditions = pgTable(
  'curriculum_step_editions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    curriculumStepId: uuid('curriculum_step_id').notNull(),
    catalogSlotId: uuid('catalog_slot_id').notNull(),
    bookId: uuid('book_id').notNull(),
    startPage: integer('start_page').notNull(),
    endPage: integer('end_page').notNull(),
    chapterLabel: text('chapter_label'),
    caption: text('caption').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('curriculum_step_editions_step_book_unique').on(
      table.curriculumStepId,
      table.bookId,
    ),
    index('curriculum_step_editions_book_id_idx').on(table.bookId),
    foreignKey({
      columns: [table.curriculumStepId, table.catalogSlotId],
      foreignColumns: [curriculumSteps.id, curriculumSteps.catalogSlotId],
      name: 'curriculum_step_editions_step_slot_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.bookId, table.catalogSlotId],
      foreignColumns: [books.id, books.catalogSlotId],
      name: 'curriculum_step_editions_book_slot_fk',
    }).onDelete('restrict'),
    check(
      'curriculum_step_editions_start_page_check',
      sql`${table.startPage} > 0`,
    ),
    check(
      'curriculum_step_editions_page_range_check',
      sql`${table.endPage} >= ${table.startPage}`,
    ),
  ],
);

export type CurriculumStepEdition = typeof curriculumStepEditions.$inferSelect;
export type NewCurriculumStepEdition =
  typeof curriculumStepEditions.$inferInsert;
