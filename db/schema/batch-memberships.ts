import { pgTable, timestamp, text, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./users";
import { batches } from "./batches";

export const BATCH_MEMBERSHIP_STATUSES = [
  "waitlisted",
  "applied",
  "approved",
  "rejected",
  "active",
  "grace",
  "removed",
] as const;

export type BatchMembershipStatus = (typeof BATCH_MEMBERSHIP_STATUSES)[number];

export const batchMembershipStatusEnum = pgEnum(
  "batch_membership_status",
  BATCH_MEMBERSHIP_STATUSES
);

export const batchMemberships = pgTable(
  "batch_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    status: batchMembershipStatusEnum("status").notNull().default("applied"),
    startDate: timestamp("start_date").notNull().defaultNow(),
    endDate: timestamp("end_date"),
    removalReason: text("removal_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_active_batch_membership_idx")
      .on(table.profileId, table.batchId)
      .where(
        sql`status IN ('waitlisted', 'applied', 'approved', 'active', 'grace')`
      ),
  ]
);

