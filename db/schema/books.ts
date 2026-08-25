import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  unique,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    language: text("language").notNull(),
    author: text("author"),
    coverUrl: text("cover_url"),
    sequenceOrder: integer("sequence_order").notNull(),
    pairedBookId: uuid("paired_book_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("books_sequence_order_language_unique").on(
      table.sequenceOrder,
      table.language,
    ),
    index("books_sequence_order_idx").on(table.sequenceOrder),
    index("books_language_idx").on(table.language),
    foreignKey({
      columns: [table.pairedBookId],
      foreignColumns: [table.id],
      name: "books_paired_book_id_books_id_fk",
    }).onDelete("set null"),
  ],
);

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
