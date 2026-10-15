import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { batches } from './batches';
import { paceAdminDutyEnum } from './pace-admin-assignments';
import { paceGroups } from './pace-groups';
import { profiles, roleEnum } from './users';

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email'),
    role: roleEnum('role').notNull(),
    batchId: uuid('batch_id').references(() => batches.id, {
      onDelete: 'set null',
    }),
    paceGroupId: uuid('pace_group_id').references(() => paceGroups.id, {
      onDelete: 'set null',
    }),
    paceDuty: paceAdminDutyEnum('pace_duty'),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    acceptedProfileId: uuid('accepted_profile_id').references(
      () => profiles.id,
      { onDelete: 'set null' },
    ),
    telegramChatId: bigint('telegram_chat_id', { mode: 'bigint' }),
    telegramUsername: text('telegram_username'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invitations_token_hash_unique').on(table.tokenHash),
    index('invitations_created_at_idx').on(table.createdAt),
    index('invitations_expires_at_idx').on(table.expiresAt),
  ],
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
