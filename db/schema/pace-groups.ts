import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { batches } from "./batches";

export const paceGroups = pgTable("pace_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull(), // e.g. 5 / 10 / 20 / 40
  cursor: integer("cursor").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PaceGroup = typeof paceGroups.$inferSelect;
export type NewPaceGroup = typeof paceGroups.$inferInsert;

