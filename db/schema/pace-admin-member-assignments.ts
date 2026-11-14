import {
  pgTable,
  timestamp,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './users';
import { batches } from './batches';
import { paceGroups } from './pace-groups';
import { paceAdminAssignments } from './pace-admin-assignments';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PACE_MEMBER_ASSIGNMENT_SOURCES = ['auto', 'manual'] as const;
export type PaceMemberAssignmentSource =
  (typeof PACE_MEMBER_ASSIGNMENT_SOURCES)[number];
export const paceMemberAssignmentSourceEnum = pgEnum(
  'pace_member_assignment_source',
  PACE_MEMBER_ASSIGNMENT_SOURCES,
);

export const PACE_MEMBER_ASSIGNMENT_ENDED_REASONS = ['moved', 'stale'] as const;
export type PaceMemberAssignmentEndedReason =
  (typeof PACE_MEMBER_ASSIGNMENT_ENDED_REASONS)[number];
export const paceMemberAssignmentEndedReasonEnum = pgEnum(
  'pace_member_assignment_ended_reason',
  PACE_MEMBER_ASSIGNMENT_ENDED_REASONS,
);

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

/**
 * pace_admin_member_assignments
 *
 * Tracks which PACE admin is responsible for which member within a batch.
 * Records are never deleted — when an assignment ends, `ended_at` and
 * `ended_reason` are set to preserve history.
 *
 * Validity rules (enforced by the service layer, not just the DB):
 *   An assignment row is considered VALID (open + fresh) when ALL of:
 *     1. ended_at IS NULL                                  (not yet closed)
 *     2. The pace_admin_profile still has a row in
 *        pace_admin_assignments for the same pace_group_id (admin not removed)
 *     3. The member's active pace_group_memberships row points
 *        to the same pace_group_id                         (member not moved)
 *     4. The member has an active/grace batch_memberships row
 *        for this batch_id                                 (member in batch)
 *
 * Rule source: task specification (EMF-106) — no pre-existing doc named
 * specific stale rules; these three stale conditions are taken verbatim from
 * the task requirements.
 */
export const paceAdminMemberAssignments = pgTable(
  'pace_admin_member_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),

    paceGroupId: uuid('pace_group_id')
      .notNull()
      .references(() => paceGroups.id, { onDelete: 'cascade' }),

    // The pace admin profile (the person doing admin duties for the member)
    paceAdminProfileId: uuid('pace_admin_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    // The member being supervised
    memberProfileId: uuid('member_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    source: paceMemberAssignmentSourceEnum('source').notNull(),

    assignedBy: uuid('assigned_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),

    createdAt: timestamp('created_at').notNull().defaultNow(),

    /** NULL = open/active assignment. Non-null = historical/ended. */
    endedAt: timestamp('ended_at'),

    /**
     * 'moved'  – member moved to another group (group membership changed)
     * 'stale'  – admin was removed, member left group, or member left batch
     */
    endedReason: paceMemberAssignmentEndedReasonEnum('ended_reason'),
  },
  (table) => [
    /**
     * Partial unique index: at most one open assignment per member per batch.
     * An open assignment is one where ended_at IS NULL.
     */
    uniqueIndex('one_open_assignment_per_member_per_batch_idx')
      .on(table.memberProfileId, table.batchId)
      .where(sql`ended_at IS NULL`),

    index('pace_member_assignments_batch_id_idx').on(table.batchId),
    index('pace_member_assignments_pace_group_id_idx').on(table.paceGroupId),
    index('pace_member_assignments_pace_admin_profile_id_idx').on(
      table.paceAdminProfileId,
    ),
    index('pace_member_assignments_member_profile_id_idx').on(
      table.memberProfileId,
    ),
    index('pace_member_assignments_ended_at_idx').on(table.endedAt),
  ],
);

export type PaceAdminMemberAssignment =
  typeof paceAdminMemberAssignments.$inferSelect;
export type NewPaceAdminMemberAssignment =
  typeof paceAdminMemberAssignments.$inferInsert;

// Re-export the admin assignment table reference for relation use
export { paceAdminAssignments };
