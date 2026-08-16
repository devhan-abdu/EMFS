import {
    pgTable,
    text,
    timestamp,
    boolean,
    integer,
    uuid,
  } from "drizzle-orm/pg-core";
  import { profiles } from "./users";
  
  export const batches = pgTable("batches", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    maxMembers: integer("max_members").notNull(),
    paceGroupCount: integer("pace_group_count").notNull().default(1),
    registrationOpen: boolean("registration_open").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  });