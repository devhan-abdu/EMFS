import { pgTable, text, timestamp, pgEnum, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const roleEnum = pgEnum("role", [
  "super_admin",
  "batch_admin",
  "pace_admin",
  "member",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: text("auth_user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("member"),
  firstName: text("first_name").notNull(),
  fatherName: text("father_name").notNull(),
  grandfatherName: text("grandfather_name"),
  telegramUsername: text("telegram_username"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;