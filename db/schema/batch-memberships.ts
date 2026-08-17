import { pgTable, timestamp, text, uuid, pgEnum } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { batches } from "./batches";

export const batchMembershipStatusEnum = pgEnum("batch_membership_status", [
  "active",
  "removed", 
  "completed", 
]);

export const batchMemberships = pgTable("batch_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  status: batchMembershipStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  removalReason: text("removal_reason"), 
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
