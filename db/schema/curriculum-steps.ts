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
import { catalogSlots } from './catalog-slots';
import { profiles } from './users';

export const curriculumSteps = pgTable(
  'curriculum_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    catalogSlotId: uuid('catalog_slot_id')
      .notNull()
      .references(() => catalogSlots.id, { onDelete: 'restrict' }),
    paceSize: integer('pace_size').notNull(),
    stepNumber: integer('step_number').notNull(),
    version: integer('version').notNull().default(1),
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
    unique('curriculum_steps_id_slot_unique').on(table.id, table.catalogSlotId),
    unique('curriculum_steps_slot_pace_step_version_unique').on(
      table.catalogSlotId,
      table.paceSize,
      table.stepNumber,
      table.version,
    ),
    check(
      'curriculum_steps_pace_size_check',
      sql`${table.paceSize} IN (5, 10, 20, 40)`,
    ),
    check('curriculum_steps_version_check', sql`${table.version} > 0`),
    check('curriculum_steps_step_number_check', sql`${table.stepNumber} > 0`),
  ],
);
