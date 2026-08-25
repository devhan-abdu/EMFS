import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { batches } from "./batches";
import { profiles } from "./users";

export const batchPacingOffsets = pgTable(
  "batch_pacing_offsets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    effectiveFromDayNumber: integer("effective_from_day_number").notNull(),
    offsetDays: integer("offset_days").notNull(),
    reason: text("reason").notNull(),
    editorId: uuid("editor_id")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("batch_pacing_offsets_batch_id_effective_from_day_number_unique").on(
      table.batchId,
      table.effectiveFromDayNumber,
    ),
    index("batch_pacing_offsets_batch_id_idx").on(table.batchId),
  ],
);

export type BatchPacingOffset = typeof batchPacingOffsets.$inferSelect;
export type NewBatchPacingOffset = typeof batchPacingOffsets.$inferInsert;
