import { pgTable, text, timestamp, uuid, unique, index, pgEnum } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { paceGroups } from "./pace-groups";
import { books } from "./books";

export const PACE_ADMIN_DUTIES = [
  "daily_task_check",
  "weekly_review",
  "progress_monitoring",
  "member_support",
] as const;

export type PaceAdminDuty = (typeof PACE_ADMIN_DUTIES)[number];

export const paceAdminDutyEnum = pgEnum("pace_admin_duty", PACE_ADMIN_DUTIES);

export const paceAdminAssignments = pgTable(
  "pace_admin_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    paceGroupId: uuid("pace_group_id")
      .notNull()
      .references(() => paceGroups.id, { onDelete: "cascade" }),
    duty: paceAdminDutyEnum("duty").notNull(),
    assignedBookId: uuid("assigned_book_id").references(() => books.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("pace_admin_profile_group_duty_unique").on(
      table.profileId,
      table.paceGroupId,
      table.duty
    ),
    index("pace_admin_assignments_profile_id_idx").on(table.profileId),
    index("pace_admin_assignments_pace_group_id_idx").on(table.paceGroupId),
    index("pace_admin_assignments_assigned_book_id_idx").on(table.assignedBookId),
  ]
);

export type PaceAdminAssignment = typeof paceAdminAssignments.$inferSelect;
export type NewPaceAdminAssignment = typeof paceAdminAssignments.$inferInsert;
