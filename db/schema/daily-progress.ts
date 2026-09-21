import {
  pgTable,
  timestamp,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { batches } from "./batches";
import { paceGroups } from "./pace-groups";
import { tasks } from "./tasks";

export const dailyProgressStatusEnum = pgEnum("daily_progress_status", [
  "done",
  "not_done",
]);

export type DailyProgressStatus =
  (typeof dailyProgressStatusEnum.enumValues)[number];

export const dailyProgress = pgTable(
  "daily_progress",
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
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    status: dailyProgressStatusEnum("status").notNull().default("not_done"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_progress_profile_task_unique_idx").on(
      table.profileId,
      table.taskId,
    ),
    index("daily_progress_pace_group_task_idx").on(
      table.paceGroupId,
      table.taskId,
    ),
    index("daily_progress_profile_batch_idx").on(
      table.profileId,
      table.batchId,
    ),
  ],
);

export type DailyProgress = typeof dailyProgress.$inferSelect;
export type NewDailyProgress = typeof dailyProgress.$inferInsert;
