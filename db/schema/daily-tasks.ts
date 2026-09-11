import { pgTable, text, timestamp, uuid, integer, pgEnum, unique, index } from "drizzle-orm/pg-core";
import { paceGroups } from "./pace-groups";
import { books } from "./books";

export const TASK_PUBLICATION_STATUS = ["draft", "published"] as const;

export type TaskPublicationStatus = (typeof TASK_PUBLICATION_STATUS)[number];

export const taskPublicationStatusEnum = pgEnum(
  "task_publication_status",
  TASK_PUBLICATION_STATUS
);

export const dailyTasks = pgTable(
  "daily_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paceGroupId: uuid("pace_group_id")
      .notNull()
      .references(() => paceGroups.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    startPage: integer("start_page").notNull(),
    endPage: integer("end_page").notNull(),
    content: text("content").notNull(),
    publicationStatus: taskPublicationStatusEnum("publication_status")
      .notNull()
      .default("draft"),
    publishedAt: timestamp("published_at"),
    publishedBy: uuid("published_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("daily_tasks_pace_group_day_unique").on(
      table.paceGroupId,
      table.dayNumber
    ),
    unique("daily_tasks_pace_group_book_page_unique").on(
      table.paceGroupId,
      table.bookId,
      table.startPage,
      table.endPage
    ),
    index("daily_tasks_pace_group_id_idx").on(table.paceGroupId),
    index("daily_tasks_book_id_idx").on(table.bookId),
    index("daily_tasks_publication_status_idx").on(table.publicationStatus),
    index("daily_tasks_day_number_idx").on(table.dayNumber),
  ]
);

export type DailyTask = typeof dailyTasks.$inferSelect;
export type NewDailyTask = typeof dailyTasks.$inferInsert;
