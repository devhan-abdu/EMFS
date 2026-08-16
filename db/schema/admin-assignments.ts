import { pgTable, timestamp, uuid, primaryKey } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { batches } from "./batches";
import { paceGroups } from "./pace-groups";

export const batchAdmins = pgTable(
  "batch_admins",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.batchId] })],
);

export const paceGroupAdmins = pgTable(
  "pace_group_admins",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    paceGroupId: uuid("pace_group_id")
      .notNull()
      .references(() => paceGroups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.paceGroupId] })],
);
