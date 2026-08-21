import {
    pgTable,
    text,
    timestamp,
    boolean,
    integer,
    uuid,
    date,
    pgEnum,
  } from "drizzle-orm/pg-core";
  import { profiles } from "./users";

  export const PACING_TYPES = ["daily", "three_times_week", "custom"] as const;
  export const pacingType = pgEnum("pacing_type", [...PACING_TYPES]);

  export const batches = pgTable("batches", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    maxMembers: integer("max_members").notNull(),
    paceGroupCount: integer("pace_group_count").notNull().default(1),
    registrationOpen: boolean("registration_open").notNull().default(true),
    startDate: date("start_date"),
    pacingType: pacingType("pacing_type"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  });