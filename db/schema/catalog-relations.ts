import { relations } from "drizzle-orm";
import { books } from "./books";
import { tasks } from "./tasks";

export const bookRelations = relations(books, ({ one, many }) => ({
  tasks: many(tasks),
  pairedBook: one(books, {
    fields: [books.pairedBookId],
    references: [books.id],
    relationName: "book_pairings",
  }),
  pairedBy: one(books, {
    fields: [books.id],
    references: [books.pairedBookId],
    relationName: "book_pairings",
  }),
}));

export const taskRelations = relations(tasks, ({ one }) => ({
  book: one(books, {
    fields: [tasks.bookId],
    references: [books.id],
  }),
}));
