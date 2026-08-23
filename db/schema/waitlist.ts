import { pgTable, timestamp, integer, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { batches } from "./batches";

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    queuePosition: integer("queue_position").notNull(),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_batch_user_waitlist_idx").on(
      table.batchId,
      table.userId
    ),
    uniqueIndex("unique_batch_queue_pos_idx").on(
      table.batchId,
      table.queuePosition
    ),
    index("waitlist_batch_queue_pos_idx").on(
      table.batchId,
      table.queuePosition
    ),
  ]
);

export type WaitlistEntry = typeof waitlist.$inferSelect;
export type NewWaitlistEntry = typeof waitlist.$inferInsert;
