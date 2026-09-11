import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { books } from "./books";
import { profiles } from "./users";

export const TASK_STATUSES = [
  "draft",
  "published",
  "superseded",
  "archived",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    dayNumber: integer("day_number").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    pageStart: integer("start_page"),
    pageEnd: integer("end_page"),
    pageReference: text("page_reference"),
    status: taskStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    previousVersionId: uuid("previous_version_id"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tasks_book_day_published_unique")
      .on(table.bookId, table.dayNumber)
      .where(sql`status = 'published'`),
    index("tasks_book_id_idx").on(table.bookId),
    index("tasks_previous_version_idx").on(table.previousVersionId),
    foreignKey({
      columns: [table.previousVersionId],
      foreignColumns: [table.id],
      name: "tasks_previous_version_id_tasks_id_fk",
    }).onDelete("set null"),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

