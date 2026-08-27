import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { applications } from "./applications";

export const handoffRecords = pgTable(
  "handoff_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    adminContactShown: text("admin_contact_shown").notNull(),
    issuedAt: timestamp("issued_at").notNull().defaultNow(),
    usedAt: timestamp("used_at"),
  },
  (table) => [
    uniqueIndex("unique_handoff_code_idx").on(table.code),
    uniqueIndex("unique_handoff_application_idx").on(table.applicationId),
  ]
);

export type HandoffRecord = typeof handoffRecords.$inferSelect;
export type NewHandoffRecord = typeof handoffRecords.$inferInsert;
