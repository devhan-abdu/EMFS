import { pgTable, integer, timestamp, uuid, unique, index } from "drizzle-orm/pg-core";
import { paceGroups } from "./pace-groups";
import { books } from "./books";

export const paceGroupCursors = pgTable(
  "pace_group_cursors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paceGroupId: uuid("pace_group_id")
      .notNull()
      .references(() => paceGroups.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    currentPage: integer("current_page").notNull().default(0),
    lastAdvancedAt: timestamp("last_advanced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("pace_group_book_unique").on(table.paceGroupId, table.bookId),
    index("pace_group_cursors_book_id_idx").on(table.bookId),
    index("pace_group_cursors_pace_group_id_idx").on(table.paceGroupId),
  ]
);

export type PaceGroupCursor = typeof paceGroupCursors.$inferSelect;
export type NewPaceGroupCursor = typeof paceGroupCursors.$inferInsert;
