import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { profiles } from "./users";
import { batches } from "./batches";

export const PACE_GROUP_PREFERENCES = ["5", "10", "20", "40"] as const;

export type PaceGroupPreference = (typeof PACE_GROUP_PREFERENCES)[number];

export const paceGroupPreferenceEnum = pgEnum(
  "pace_group_preference",
  PACE_GROUP_PREFERENCES,
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, {
        onDelete: "cascade",
      }),

    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, {
        onDelete: "cascade",
      }),

    firstName: text("first_name").notNull(),
    fatherName: text("father_name").notNull(),
    grandfatherName: text("grandfather_name"),

    email: text("email").notNull(),
    telegramUsername: text("telegram_username").notNull(),
    phoneNumber: text("phone_number").notNull(),

    paceGroup: paceGroupPreferenceEnum("pace_group"),

    createdAt: timestamp("created_at").notNull().defaultNow(),

    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_profile_batch_application_idx").on(
      table.profileId,
      table.batchId,
    ),

    index("applications_batch_id_idx").on(table.batchId),

    index("applications_profile_id_idx").on(table.profileId),
  ],
);

export type Application = typeof applications.$inferSelect;

export type NewApplication = typeof applications.$inferInsert;
