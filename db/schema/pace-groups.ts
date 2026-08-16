import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { batches } from "./batches";

export const paceGroups = pgTable("pace_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull(), // e.g. 5 / 10 / 20 / 40
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
