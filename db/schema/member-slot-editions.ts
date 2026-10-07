import {
  pgTable,
  timestamp,
  uuid,
  unique,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { books } from './books';
import { catalogSlots } from './catalog-slots';
import { paceGroupMemberships } from './pace-group-memberships';

export const memberSlotEditions = pgTable(
  'member_slot_editions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paceGroupMembershipId: uuid('pace_group_membership_id')
      .notNull()
      .references(() => paceGroupMemberships.id, { onDelete: 'cascade' }),
    catalogSlotId: uuid('catalog_slot_id')
      .notNull()
      .references(() => catalogSlots.id, { onDelete: 'restrict' }),
    bookId: uuid('book_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('member_slot_editions_membership_slot_unique').on(
      table.paceGroupMembershipId,
      table.catalogSlotId,
    ),
    index('member_slot_editions_book_id_idx').on(table.bookId),
    foreignKey({
      columns: [table.bookId, table.catalogSlotId],
      foreignColumns: [books.id, books.catalogSlotId],
      name: 'member_slot_editions_book_slot_fk',
    }).onDelete('restrict'),
  ],
);

export type MemberSlotEdition = typeof memberSlotEditions.$inferSelect;
export type NewMemberSlotEdition = typeof memberSlotEditions.$inferInsert;
