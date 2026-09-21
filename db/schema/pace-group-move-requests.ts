import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './users';
import { paceGroups } from './pace-groups';
import { batches } from './batches';

export const moveRequestStatusEnum = pgEnum('move_request_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

export const paceGroupMoveRequests = pgTable(
  'pace_group_move_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    fromPaceGroupId: uuid('from_pace_group_id').references(
      () => paceGroups.id,
      { onDelete: 'set null' },
    ),
    toPaceGroupId: uuid('to_pace_group_id')
      .notNull()
      .references(() => paceGroups.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    status: moveRequestStatusEnum('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('unique_pending_move_request_idx')
      .on(table.profileId, table.batchId)
      .where(sql`status = 'pending'`),
    index('pace_group_move_requests_batch_id_idx').on(table.batchId),
    index('pace_group_move_requests_profile_id_idx').on(table.profileId),
    index('pace_group_move_requests_status_idx').on(table.status),
    index('pace_group_move_requests_created_at_idx').on(table.createdAt),
  ],
);

export type PaceGroupMoveRequest = typeof paceGroupMoveRequests.$inferSelect;
export type NewPaceGroupMoveRequest = typeof paceGroupMoveRequests.$inferInsert;
