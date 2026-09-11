import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { paceGroups } from "./pace-groups";

export const membershipMoveAudit = pgTable(
  "membership_move_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    fromPaceGroupId: uuid("from_pace_group_id").references(() => paceGroups.id, {
      onDelete: "set null",
    }),
    toPaceGroupId: uuid("to_pace_group_id").references(() => paceGroups.id, {
      onDelete: "set null",
    }),
    moveReason: text("move_reason").notNull(),
    movedBy: uuid("moved_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    moveDate: timestamp("move_date").notNull().defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("membership_move_audit_profile_id_idx").on(table.profileId),
    index("membership_move_audit_from_pace_group_id_idx").on(
      table.fromPaceGroupId
    ),
    index("membership_move_audit_to_pace_group_id_idx").on(table.toPaceGroupId),
    index("membership_move_audit_move_date_idx").on(table.moveDate),
  ]
);

export type MembershipMoveAudit = typeof membershipMoveAudit.$inferSelect;
export type NewMembershipMoveAudit = typeof membershipMoveAudit.$inferInsert;
