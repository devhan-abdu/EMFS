import { relations } from 'drizzle-orm';
import { books } from './books';

export const bookRelations = relations(books, ({ one }) => ({
  pairedBook: one(books, {
    fields: [books.pairedBookId],
    references: [books.id],
    relationName: 'book_pairings',
  }),
  pairedBy: one(books, {
    fields: [books.id],
    references: [books.pairedBookId],
    relationName: 'book_pairings',
  }),
}));
