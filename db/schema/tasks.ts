import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { books } from "./books";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    dayNumber: integer("day_number").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("tasks_book_day_unique").on(table.bookId, table.dayNumber),
    index("tasks_book_id_idx").on(table.bookId),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
