import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { batches } from "./batches";
import { batchMembershipStatusEnum } from "./batch-memberships";

export const membershipAuditLogs = pgTable("membership_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  fromState: batchMembershipStatusEnum("from_state").notNull(),
  toState: batchMembershipStatusEnum("to_state").notNull(),
  fromBatchId: uuid("from_batch_id").references(() => batches.id, {
    onDelete: "set null",
  }),
  toBatchId: uuid("to_batch_id").references(() => batches.id, {
    onDelete: "set null",
  }),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export type MembershipAuditLog = typeof membershipAuditLogs.$inferSelect;
export type NewMembershipAuditLog = typeof membershipAuditLogs.$inferInsert;
