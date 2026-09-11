import { pgTable, timestamp, text, uuid, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./users";
import { paceGroups } from "./pace-groups";
import { batches } from "./batches";

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "switched",
  "removed",
]);

export const paceGroupMemberships = pgTable(
  "pace_group_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    paceGroupId: uuid("pace_group_id")
      .notNull()
      .references(() => paceGroups.id, { onDelete: "cascade" }),
    status: membershipStatusEnum("status").notNull().default("active"),
    startDate: timestamp("start_date").notNull().defaultNow(),
    endDate: timestamp("end_date"),
    switchReason: text("switch_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_active_pace_group_membership_idx")
      .on(table.profileId, table.batchId)
      .where(sql`status = 'active'`),
    index("pace_group_memberships_profile_id_idx").on(table.profileId),
    index("pace_group_memberships_batch_id_idx").on(table.batchId),
    index("pace_group_memberships_pace_group_id_idx").on(table.paceGroupId),
    index("pace_group_memberships_status_idx").on(table.status),
  ]
);
