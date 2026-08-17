import { pgTable, timestamp, text, uuid, pgEnum } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { paceGroups } from "./pace-groups";

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "switched",
  "removed",
]);

export const paceGroupMemberships = pgTable("pace_group_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  paceGroupId: uuid("pace_group_id")
    .notNull()
    .references(() => paceGroups.id, { onDelete: "cascade" }),
  status: membershipStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  switchReason: text("switch_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
