import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { batches } from './batches';
import { profiles } from './users';

export const curriculumSteps = pgTable(
  'curriculum_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slotNumber: integer('slot_number').notNull(),
    paceSize: integer('pace_size').notNull(), // 5, 10, 20, 40
    stepNumber: integer('step_number').notNull(), // Step 1, Step 2, etc.
    version: integer('version').notNull().default(1),

    // Reading boundaries
    startPage: integer('start_page').notNull(),
    endPage: integer('end_page').notNull(),

    caption: text('caption').notNull(), // English / Primary text
    captionAm: text('caption_am'), // Amharic translation
    imageUrl: text('image_url'),

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
    unique('curriculum_steps_slot_pace_step_version_unique').on(
      table.slotNumber,
      table.paceSize,
      table.stepNumber,
      table.version,
    ),
    check(
      'curriculum_steps_pace_size_check',
      sql`${table.paceSize} IN (5, 10, 20, 40)`,
    ),
    check('curriculum_steps_slot_number_check', sql`${table.slotNumber} > 0`),
    check('curriculum_steps_step_number_check', sql`${table.stepNumber} > 0`),
    check('curriculum_steps_version_check', sql`${table.version} > 0`),
  ],
);
