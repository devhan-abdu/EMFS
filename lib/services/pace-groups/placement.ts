import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import {
  applications,
  batchMemberships,
  batches,
  membershipMoveAudit,
  paceGroupMemberships,
  paceGroupMoveRequests,
  paceGroups,
  profiles,
  user,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import type {
  GetBatchRosterFilterInput,
  AssignMemberPaceGroupInput,
  MoveMemberPaceGroupInput,
  BulkAssignMembersPaceGroupInput,
  CreateMoveRequestInput,
  ApproveMoveRequestInput,
  RejectMoveRequestInput,
  GetMoveHistoryFilterInput,
} from '@/lib/validations/placement';

export type PlacementErrorCode =
  | 'BATCH_NOT_FOUND'
  | 'MEMBER_NOT_ENROLLED'
  | 'PACE_GROUP_NOT_FOUND'
  | 'PACE_GROUP_ARCHIVED'
  | 'MEMBER_ALREADY_PLACED'
  | 'MEMBER_NOT_PLACED'
  | 'SAME_PACE_GROUP'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'MOVE_REQUEST_NOT_FOUND'
  | 'MOVE_REQUEST_NOT_PENDING'
  | 'ACTIVE_REQUEST_EXISTS';

export class PlacementError extends Error {
  code: PlacementErrorCode;
  constructor(code: PlacementErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PlacementError';
  }
}

export type RosterPlacementStatus = 'placed' | 'unplaced';

export type BatchRosterMember = {
  profileId: string;
  authUserId: string;
  name: string;
  firstName: string | null;
  fatherName: string | null;
  grandfatherName: string | null;
  email: string;
  telegramUsername: string | null;
  phoneNumber: string | null;

  // Batch membership
  membershipId: string;
  batchMembershipStatus: string;
  enrolledAt: Date;

  // Placement (DERIVED)
  placementStatus: RosterPlacementStatus;

  // Intake pace preference (e.g. '5', '10', '20', '40', or null)
  pacePreference: string | null;

  // Current assigned pace group (if placed)
  paceGroupId: string | null;
  paceGroupName: string | null;
  paceGroupSize: number | null;
  paceGroupMembershipId: string | null;
  placedAt: Date | null;
};

export type BatchRosterSummary = {
  batchId: string;
  batchName: string;
  totalMembers: number;
  placedCount: number;
  unplacedCount: number;
  members: BatchRosterMember[];
};

export type AssignmentResult = {
  membership: typeof paceGroupMemberships.$inferSelect;
  audit: typeof membershipMoveAudit.$inferSelect;
};

export type MoveResult = {
  previousMembershipId: string;
  newMembership: typeof paceGroupMemberships.$inferSelect;
  audit: typeof membershipMoveAudit.$inferSelect;
};

export type BulkAssignmentItemResult = {
  profileId: string;
  previousMembershipId: string | null;
  newMembershipId: string;
  auditId: string;
  fromPaceGroupId: string | null;
  toPaceGroupId: string;
  operation: 'assigned' | 'moved';
};

export type BulkAssignmentResult = {
  batchId: string;
  targetGroupId: string;
  processedCount: number;
  results: BulkAssignmentItemResult[];
};

export type PendingMoveRequestItem = {
  id: string;
  profileId: string;
  name: string;
  firstName: string | null;
  fatherName: string | null;
  email: string;
  telegramUsername: string | null;
  phoneNumber: string | null;
  currentPaceGroupId: string | null;
  currentPaceGroupName: string | null;
  requestedPaceGroupId: string;
  requestedPaceGroupName: string;
  requestedPaceGroupSize: number;
  status: string;
  reason: string | null;
  pacePreference: string | null;
  createdAt: Date;
};

export type ApproveMoveRequestResult = {
  requestId: string;
  previousMembershipId: string | null;
  newMembership: typeof paceGroupMemberships.$inferSelect;
  audit: typeof membershipMoveAudit.$inferSelect;
  status: 'approved';
};

export type RejectMoveRequestResult = {
  requestId: string;
  status: 'rejected';
  rejectionReason: string | null;
};

export type MoveHistoryItem = {
  id: string;
  profileId: string;
  memberName: string;
  memberEmail: string;
  fromPaceGroupId: string | null;
  fromPaceGroupName: string | null;
  toPaceGroupId: string;
  toPaceGroupName: string;
  moveReason: string;
  movedById: string | null;
  movedByName: string | null;
  moveDate: Date;
  notes: string | null;
};

export type MoveHistoryResult = {
  batchId: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: MoveHistoryItem[];
};

/**
 * Retrieves the roster of active enrolled members in a batch with their derived placement state
 * and intake pace preferences, supporting multi-criteria filtering and search.
 */
export async function getBatchRoster(
  input: GetBatchRosterFilterInput,
  executor: DbOrTx = db,
): Promise<BatchRosterSummary> {
  const {
    batchId,
    placementStatus = 'all',
    pacePreference = 'all',
    search,
  } = input;

  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, batchId),
  });

  if (!batch) {
    throw new PlacementError(
      'BATCH_NOT_FOUND',
      `Batch '${batchId}' was not found.`,
    );
  }

  // Base conditions: strictly scoped to this batch and active/grace members
  const conditions = [
    eq(batchMemberships.batchId, batchId),
    inArray(batchMemberships.status, ['active', 'grace']),
  ];

  // Derived placement filtering
  if (placementStatus === 'placed') {
    conditions.push(
      isNotNull(paceGroupMemberships.id),
      eq(paceGroupMemberships.status, 'active'),
    );
  } else if (placementStatus === 'unplaced') {
    conditions.push(isNull(paceGroupMemberships.id));
  }

  // Intake cadence preference filtering
  if (pacePreference !== 'all') {
    conditions.push(eq(applications.paceGroup, pacePreference));
  }

  // Search filter across name, email, phone, telegram, and pace group name
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(profiles.firstName, term),
        ilike(profiles.fatherName, term),
        ilike(profiles.grandfatherName, term),
        ilike(user.name, term),
        ilike(user.email, term),
        ilike(applications.email, term),
        ilike(applications.telegramUsername, term),
        ilike(profiles.telegramUsername, term),
        ilike(profiles.phone, term),
        ilike(applications.phoneNumber, term),
        ilike(paceGroups.name, term),
        sql`concat(${profiles.firstName}, ' ', ${profiles.fatherName}) ILIKE ${term}`,
      )!,
    );
  }

  const rows = await executor
    .select({
      profileId: profiles.id,
      authUserId: profiles.authUserId,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      grandfatherName: profiles.grandfatherName,
      userName: user.name,
      userEmail: user.email,
      profileTelegram: profiles.telegramUsername,
      profilePhone: profiles.phone,
      appEmail: applications.email,
      appTelegram: applications.telegramUsername,
      appPhone: applications.phoneNumber,
      appPacePreference: applications.paceGroup,
      membershipId: batchMemberships.id,
      batchMembershipStatus: batchMemberships.status,
      enrolledAt: batchMemberships.createdAt,
      paceGroupMembershipId: paceGroupMemberships.id,
      paceGroupId: paceGroups.id,
      paceGroupName: paceGroups.name,
      paceGroupSize: paceGroups.size,
      placedAt: paceGroupMemberships.startDate,
    })
    .from(batchMemberships)
    .innerJoin(profiles, eq(profiles.id, batchMemberships.profileId))
    .innerJoin(user, eq(user.id, profiles.authUserId))
    .leftJoin(
      applications,
      and(
        eq(applications.profileId, profiles.id),
        eq(applications.batchId, batchId),
      ),
    )
    .leftJoin(
      paceGroupMemberships,
      and(
        eq(paceGroupMemberships.profileId, profiles.id),
        eq(paceGroupMemberships.batchId, batchId),
        eq(paceGroupMemberships.status, 'active'),
      ),
    )
    .leftJoin(paceGroups, eq(paceGroups.id, paceGroupMemberships.paceGroupId))
    .where(and(...conditions))
    .orderBy(
      asc(profiles.firstName),
      asc(profiles.fatherName),
      desc(batchMemberships.createdAt),
    );

  const members: BatchRosterMember[] = rows.map((row) => {
    const isPlaced = Boolean(row.paceGroupMembershipId && row.paceGroupId);
    const placementStatusValue: RosterPlacementStatus = isPlaced
      ? 'placed'
      : 'unplaced';
    const computedName =
      [row.firstName, row.fatherName].filter(Boolean).join(' ') ||
      row.userName ||
      'Unknown Member';

    return {
      profileId: row.profileId,
      authUserId: row.authUserId,
      name: computedName,
      firstName: row.firstName,
      fatherName: row.fatherName,
      grandfatherName: row.grandfatherName,
      email: row.userEmail || row.appEmail || '',
      telegramUsername: row.profileTelegram || row.appTelegram || null,
      phoneNumber: row.profilePhone || row.appPhone || null,

      membershipId: row.membershipId,
      batchMembershipStatus: row.batchMembershipStatus,
      enrolledAt: row.enrolledAt,

      placementStatus: placementStatusValue,
      pacePreference: row.appPacePreference ?? null,

      paceGroupId: isPlaced ? row.paceGroupId : null,
      paceGroupName: isPlaced ? row.paceGroupName : null,
      paceGroupSize: isPlaced ? row.paceGroupSize : null,
      paceGroupMembershipId: isPlaced ? row.paceGroupMembershipId : null,
      placedAt: isPlaced ? row.placedAt : null,
    };
  });

  const placedCount = members.filter(
    (m) => m.placementStatus === 'placed',
  ).length;
  const unplacedCount = members.filter(
    (m) => m.placementStatus === 'unplaced',
  ).length;

  return {
    batchId: batch.id,
    batchName: batch.name,
    totalMembers: members.length,
    placedCount,
    unplacedCount,
    members,
  };
}

/**
 * Lightweight placed / unplaced / total counts for a batch (no member rows).
 */
export async function getBatchPlacementStats(
  batchId: string,
  executor: DbOrTx = db,
): Promise<{ total: number; placed: number; unplaced: number }> {
  const [totalRow] = await executor
    .select({ value: count() })
    .from(batchMemberships)
    .where(
      and(
        eq(batchMemberships.batchId, batchId),
        inArray(batchMemberships.status, ['active', 'grace']),
      ),
    );

  const [placedRow] = await executor
    .select({ value: count() })
    .from(paceGroupMemberships)
    .innerJoin(
      batchMemberships,
      and(
        eq(batchMemberships.profileId, paceGroupMemberships.profileId),
        eq(batchMemberships.batchId, paceGroupMemberships.batchId),
      ),
    )
    .where(
      and(
        eq(paceGroupMemberships.batchId, batchId),
        eq(paceGroupMemberships.status, 'active'),
        inArray(batchMemberships.status, ['active', 'grace']),
      ),
    );

  const total = Number(totalRow?.value ?? 0);
  const placed = Number(placedRow?.value ?? 0);

  return {
    total,
    placed,
    unplaced: Math.max(0, total - placed),
  };
}

/**
 * Active membership counts keyed by pace group id for a batch.
 */
export async function getPaceGroupMemberCounts(
  batchId: string,
  executor: DbOrTx = db,
): Promise<Record<string, number>> {
  const rows = await executor
    .select({
      paceGroupId: paceGroupMemberships.paceGroupId,
      memberCount: count(),
    })
    .from(paceGroupMemberships)
    .where(
      and(
        eq(paceGroupMemberships.batchId, batchId),
        eq(paceGroupMemberships.status, 'active'),
      ),
    )
    .groupBy(paceGroupMemberships.paceGroupId);

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.paceGroupId] = Number(row.memberCount);
  }
  return counts;
}

/**
 * Assigns an unplaced active batch member to an existing pace group in a single atomic transaction.
 *
 * Transaction Steps:
 * 1. Verifies the batch exists.
 * 2. Verifies the member has an active or grace batch_membership for that batch.
 * 3. Verifies the target pace group belongs to that batch and is not archived.
 * 4. Verifies no existing active pace_group_membership exists for this member in this batch.
 * 5. Inserts new active pace_group_membership record.
 * 6. Inserts exactly one membership_move_audit record (fromPaceGroupId = null).
 *
 * Invariants:
 * - Does NOT modify batch_memberships.
 * - Does NOT delete or alter historical records.
 * - Enforces at most one active pace group per member per batch.
 */
export async function assignMemberToPaceGroup(
  input: AssignMemberPaceGroupInput,
  actorProfileId: string,
  executor: DbOrTx = db,
): Promise<AssignmentResult> {
  const { batchId, profileId, paceGroupId, notes } = input;

  const runTransaction = async (tx: DbOrTx) => {
    // 1. Verify batch exists
    const [batch] = await tx
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new PlacementError(
        'BATCH_NOT_FOUND',
        `Batch '${batchId}' was not found.`,
      );
    }

    // 2. Verify member has active/grace batch membership
    const [batchMembership] = await tx
      .select({ id: batchMemberships.id, status: batchMemberships.status })
      .from(batchMemberships)
      .where(
        and(
          eq(batchMemberships.profileId, profileId),
          eq(batchMemberships.batchId, batchId),
          inArray(batchMemberships.status, ['active', 'grace']),
        ),
      )
      .limit(1);

    if (!batchMembership) {
      throw new PlacementError(
        'MEMBER_NOT_ENROLLED',
        'Member does not have an active enrollment in this batch.',
      );
    }

    // 3. Verify target pace group belongs to that batch and is not archived
    const [targetGroup] = await tx
      .select({
        id: paceGroups.id,
        batchId: paceGroups.batchId,
        archived: paceGroups.archived,
      })
      .from(paceGroups)
      .where(eq(paceGroups.id, paceGroupId))
      .limit(1);

    if (!targetGroup || targetGroup.batchId !== batchId) {
      throw new PlacementError(
        'PACE_GROUP_NOT_FOUND',
        'Target pace group does not exist in this batch.',
      );
    }

    if (targetGroup.archived) {
      throw new PlacementError(
        'PACE_GROUP_ARCHIVED',
        'Cannot assign a member to an archived pace group.',
      );
    }

    // 4. Verify no active pace group membership exists
    const [existingActive] = await tx
      .select({ id: paceGroupMemberships.id })
      .from(paceGroupMemberships)
      .where(
        and(
          eq(paceGroupMemberships.profileId, profileId),
          eq(paceGroupMemberships.batchId, batchId),
          eq(paceGroupMemberships.status, 'active'),
        ),
      )
      .limit(1);

    if (existingActive) {
      throw new PlacementError(
        'MEMBER_ALREADY_PLACED',
        'Member already has an active pace group assignment in this batch. Use move operation instead.',
      );
    }

    const now = new Date();

    // 5. Insert new active pace_group_membership
    const [newMembership] = await tx
      .insert(paceGroupMemberships)
      .values({
        profileId,
        batchId,
        paceGroupId,
        status: 'active',
        startDate: now,
      })
      .returning();

    // 6. Insert audit record (fromPaceGroupId = null)
    const [audit] = await tx
      .insert(membershipMoveAudit)
      .values({
        profileId,
        fromPaceGroupId: null,
        toPaceGroupId: paceGroupId,
        moveReason: 'Initial placement',
        movedBy: actorProfileId,
        notes: notes ?? null,
        moveDate: now,
      })
      .returning();

    return {
      membership: newMembership,
      audit,
    };
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runTransaction(tx));
  }

  return await runTransaction(executor);
}

/**
 * Moves an already placed member from their current pace group to another pace group in the same batch
 * in a single atomic transaction.
 *
 * Transaction Steps:
 * 1. Verifies the batch exists.
 * 2. Verifies the member has an active or grace batch_membership for that batch.
 * 3. Verifies the target pace group belongs to that batch and is not archived.
 * 4. Verifies the member has an existing active pace_group_membership.
 * 5. Verifies target group is different from current active group.
 * 6. Closes the previous active membership (status = 'switched', endDate = now(), switchReason = moveReason).
 * 7. Inserts the new active pace_group_membership.
 * 8. Inserts exactly one membership_move_audit record (fromPaceGroupId = previousGroup.id).
 *
 * Invariants:
 * - Does NOT modify batch_memberships.
 * - Does NOT delete or alter historical records or progress.
 * - Enforces at most one active pace group per member per batch.
 */
export async function moveMemberToPaceGroup(
  input: MoveMemberPaceGroupInput,
  actorProfileId: string,
  executor: DbOrTx = db,
): Promise<MoveResult> {
  const { batchId, profileId, toPaceGroupId, moveReason, notes } = input;

  const runTransaction = async (tx: DbOrTx) => {
    // 1. Verify batch exists
    const [batch] = await tx
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new PlacementError(
        'BATCH_NOT_FOUND',
        `Batch '${batchId}' was not found.`,
      );
    }

    // 2. Verify member has active/grace batch membership
    const [batchMembership] = await tx
      .select({ id: batchMemberships.id, status: batchMemberships.status })
      .from(batchMemberships)
      .where(
        and(
          eq(batchMemberships.profileId, profileId),
          eq(batchMemberships.batchId, batchId),
          inArray(batchMemberships.status, ['active', 'grace']),
        ),
      )
      .limit(1);

    if (!batchMembership) {
      throw new PlacementError(
        'MEMBER_NOT_ENROLLED',
        'Member does not have an active enrollment in this batch.',
      );
    }

    // 3. Verify target pace group belongs to that batch and is not archived
    const [targetGroup] = await tx
      .select({
        id: paceGroups.id,
        batchId: paceGroups.batchId,
        archived: paceGroups.archived,
      })
      .from(paceGroups)
      .where(eq(paceGroups.id, toPaceGroupId))
      .limit(1);

    if (!targetGroup || targetGroup.batchId !== batchId) {
      throw new PlacementError(
        'PACE_GROUP_NOT_FOUND',
        'Target pace group does not exist in this batch.',
      );
    }

    if (targetGroup.archived) {
      throw new PlacementError(
        'PACE_GROUP_ARCHIVED',
        'Cannot move a member to an archived pace group.',
      );
    }

    // 4. Verify existing active pace group membership
    const [currentActive] = await tx
      .select({
        id: paceGroupMemberships.id,
        paceGroupId: paceGroupMemberships.paceGroupId,
      })
      .from(paceGroupMemberships)
      .where(
        and(
          eq(paceGroupMemberships.profileId, profileId),
          eq(paceGroupMemberships.batchId, batchId),
          eq(paceGroupMemberships.status, 'active'),
        ),
      )
      .limit(1);

    if (!currentActive) {
      throw new PlacementError(
        'MEMBER_NOT_PLACED',
        'Member does not have an active pace group assignment to move from. Use assign operation instead.',
      );
    }

    // 5. Verify target group is different
    if (currentActive.paceGroupId === toPaceGroupId) {
      throw new PlacementError(
        'SAME_PACE_GROUP',
        'Member is already in the target pace group.',
      );
    }

    const now = new Date();

    // 6. Close the previous active membership
    await tx
      .update(paceGroupMemberships)
      .set({
        status: 'switched',
        endDate: now,
        switchReason: moveReason,
      })
      .where(eq(paceGroupMemberships.id, currentActive.id));

    // 7. Insert new active pace_group_membership
    const [newMembership] = await tx
      .insert(paceGroupMemberships)
      .values({
        profileId,
        batchId,
        paceGroupId: toPaceGroupId,
        status: 'active',
        startDate: now,
      })
      .returning();

    // 8. Insert audit record (fromPaceGroupId = previous)
    const [audit] = await tx
      .insert(membershipMoveAudit)
      .values({
        profileId,
        fromPaceGroupId: currentActive.paceGroupId,
        toPaceGroupId,
        moveReason,
        movedBy: actorProfileId,
        notes: notes ?? null,
        moveDate: now,
      })
      .returning();

    return {
      previousMembershipId: currentActive.id,
      newMembership,
      audit,
    };
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runTransaction(tx));
  }

  return await runTransaction(executor);
}

/**
 * Bulk assigns multiple members (unplaced or moving) to an existing pace group in a single atomic transaction.
 *
 * Transaction Steps:
 * 1. Verifies the batch exists.
 * 2. Verifies the target pace group belongs to that batch and is not archived.
 * 3. Deduplicates selected profile IDs and ensures at least one member is selected.
 * 4. Verifies EVERY selected member has an active/grace enrollment in batch_memberships for this batch.
 *    If ANY member is not actively enrolled, the entire operation fails and rolls back.
 * 5. Queries all existing active pace_group_memberships for these members in this batch.
 * 6. Closes all existing active memberships (status = 'switched', endDate = now(), switchReason = 'Bulk assignment').
 * 7. Inserts new active pace_group_memberships for all selected members.
 * 8. Inserts corresponding membership_move_audit records for each member:
 *    - For unplaced members: fromPaceGroupId = null, moveReason = 'Bulk initial placement'
 *    - For placed members: fromPaceGroupId = currentActive.paceGroupId, moveReason = 'Bulk group move'
 *    - movedBy = actorProfileId (derived strictly from server session)
 *
 * Atomicity & Invariants:
 * - If ANY step or member fails, the entire transaction rolls back. No partial bulk assignments.
 * - Does NOT modify batch_memberships.
 * - Does NOT delete or alter daily_progress, reflections, attendance, or historical records.
 * - Respects the partial unique index unique_active_pace_group_membership_idx.
 */
export async function bulkAssignMembersToPaceGroup(
  input: BulkAssignMembersPaceGroupInput,
  actorProfileId: string,
  executor: DbOrTx = db,
): Promise<BulkAssignmentResult> {
  const { batchId, targetGroupId, profileIds, notes } = input;

  const runTransaction = async (tx: DbOrTx) => {
    // 1. Verify batch exists
    const [batch] = await tx
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new PlacementError(
        'BATCH_NOT_FOUND',
        `Batch '${batchId}' was not found.`,
      );
    }

    // 2. Verify target pace group belongs to this batch and is not archived
    const [targetGroup] = await tx
      .select({
        id: paceGroups.id,
        batchId: paceGroups.batchId,
        archived: paceGroups.archived,
      })
      .from(paceGroups)
      .where(eq(paceGroups.id, targetGroupId))
      .limit(1);

    if (!targetGroup || targetGroup.batchId !== batchId) {
      throw new PlacementError(
        'PACE_GROUP_NOT_FOUND',
        'Target pace group does not exist in this batch.',
      );
    }

    if (targetGroup.archived) {
      throw new PlacementError(
        'PACE_GROUP_ARCHIVED',
        'Cannot assign members to an archived pace group.',
      );
    }

    // 3. Deduplicate profile IDs
    const uniqueProfileIds = Array.from(new Set(profileIds));
    if (uniqueProfileIds.length === 0) {
      throw new PlacementError(
        'INVALID_INPUT',
        'At least one member must be selected for bulk assignment.',
      );
    }

    // 4. Verify all members have active/grace batch enrollment
    const enrolledMembers = await tx
      .select({ profileId: batchMemberships.profileId })
      .from(batchMemberships)
      .where(
        and(
          eq(batchMemberships.batchId, batchId),
          inArray(batchMemberships.profileId, uniqueProfileIds),
          inArray(batchMemberships.status, ['active', 'grace']),
        ),
      );

    const enrolledProfileSet = new Set(enrolledMembers.map((m) => m.profileId));
    const hasUnenrolled = uniqueProfileIds.some(
      (id) => !enrolledProfileSet.has(id),
    );

    if (hasUnenrolled) {
      throw new PlacementError(
        'MEMBER_NOT_ENROLLED',
        'One or more selected members do not have an active enrollment in this batch.',
      );
    }

    // 5. Query existing active pace group memberships for the selected members
    const existingActiveMemberships = await tx
      .select({
        id: paceGroupMemberships.id,
        profileId: paceGroupMemberships.profileId,
        paceGroupId: paceGroupMemberships.paceGroupId,
      })
      .from(paceGroupMemberships)
      .where(
        and(
          eq(paceGroupMemberships.batchId, batchId),
          inArray(paceGroupMemberships.profileId, uniqueProfileIds),
          eq(paceGroupMemberships.status, 'active'),
        ),
      );

    const activeMap = new Map(
      existingActiveMemberships.map((m) => [m.profileId, m]),
    );

    const now = new Date();

    // 6. Close existing active memberships for placed members
    if (existingActiveMemberships.length > 0) {
      const existingIds = existingActiveMemberships.map((m) => m.id);
      await tx
        .update(paceGroupMemberships)
        .set({
          status: 'switched',
          endDate: now,
          switchReason: 'Bulk assignment',
        })
        .where(inArray(paceGroupMemberships.id, existingIds));
    }

    // 7. Insert new active memberships for all selected members
    const newMembershipsToInsert = uniqueProfileIds.map((profileId) => ({
      profileId,
      batchId,
      paceGroupId: targetGroupId,
      status: 'active' as const,
      startDate: now,
    }));

    const insertedMemberships = await tx
      .insert(paceGroupMemberships)
      .values(newMembershipsToInsert)
      .returning();

    const insertedMap = new Map(
      insertedMemberships.map((m) => [m.profileId, m]),
    );

    // 8. Insert audit records for each member
    const auditsToInsert = uniqueProfileIds.map((profileId) => {
      const previous = activeMap.get(profileId);
      const isMove = Boolean(previous);
      return {
        profileId,
        fromPaceGroupId: previous ? previous.paceGroupId : null,
        toPaceGroupId: targetGroupId,
        moveReason: isMove ? 'Bulk group move' : 'Bulk initial placement',
        movedBy: actorProfileId,
        notes: notes ?? null,
        moveDate: now,
      };
    });

    const insertedAudits = await tx
      .insert(membershipMoveAudit)
      .values(auditsToInsert)
      .returning();

    const auditMap = new Map(insertedAudits.map((a) => [a.profileId, a]));

    const results: BulkAssignmentItemResult[] = uniqueProfileIds.map(
      (profileId) => {
        const previous = activeMap.get(profileId);
        const inserted = insertedMap.get(profileId)!;
        const audit = auditMap.get(profileId)!;
        return {
          profileId,
          previousMembershipId: previous ? previous.id : null,
          newMembershipId: inserted.id,
          auditId: audit.id,
          fromPaceGroupId: previous ? previous.paceGroupId : null,
          toPaceGroupId: targetGroupId,
          operation: previous ? ('moved' as const) : ('assigned' as const),
        };
      },
    );

    return {
      batchId,
      targetGroupId,
      processedCount: results.length,
      results,
    };
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runTransaction(tx));
  }

  return await runTransaction(executor);
}

/**
 * Creates a new pace group move request for an enrolled member in a batch.
 */
export async function createMoveRequest(
  input: CreateMoveRequestInput,
  executor: DbOrTx = db,
): Promise<typeof paceGroupMoveRequests.$inferSelect> {
  const { batchId, profileId, toPaceGroupId, reason } = input;

  const runTransaction = async (tx: DbOrTx) => {
    // 1. Verify batch exists
    const [batch] = await tx
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new PlacementError(
        'BATCH_NOT_FOUND',
        `Batch '${batchId}' was not found.`,
      );
    }

    // 2. Verify member is actively enrolled in batch
    const [enrollment] = await tx
      .select({ id: batchMemberships.id })
      .from(batchMemberships)
      .where(
        and(
          eq(batchMemberships.batchId, batchId),
          eq(batchMemberships.profileId, profileId),
          inArray(batchMemberships.status, ['active', 'grace']),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new PlacementError(
        'MEMBER_NOT_ENROLLED',
        'Member does not have an active enrollment in this batch.',
      );
    }

    // 3. Verify target pace group exists in batch and is not archived
    const [targetGroup] = await tx
      .select({
        id: paceGroups.id,
        batchId: paceGroups.batchId,
        archived: paceGroups.archived,
      })
      .from(paceGroups)
      .where(eq(paceGroups.id, toPaceGroupId))
      .limit(1);

    if (!targetGroup || targetGroup.batchId !== batchId) {
      throw new PlacementError(
        'PACE_GROUP_NOT_FOUND',
        'Target pace group does not exist in this batch.',
      );
    }

    if (targetGroup.archived) {
      throw new PlacementError(
        'PACE_GROUP_ARCHIVED',
        'Cannot request a move to an archived pace group.',
      );
    }

    // 4. Find current active group
    const [currentActive] = await tx
      .select({
        id: paceGroupMemberships.id,
        paceGroupId: paceGroupMemberships.paceGroupId,
      })
      .from(paceGroupMemberships)
      .where(
        and(
          eq(paceGroupMemberships.batchId, batchId),
          eq(paceGroupMemberships.profileId, profileId),
          eq(paceGroupMemberships.status, 'active'),
        ),
      )
      .limit(1);

    if (currentActive && currentActive.paceGroupId === toPaceGroupId) {
      throw new PlacementError(
        'SAME_PACE_GROUP',
        'Member is already in the requested pace group.',
      );
    }

    // 5. Check if active pending request already exists
    const [existingPending] = await tx
      .select({ id: paceGroupMoveRequests.id })
      .from(paceGroupMoveRequests)
      .where(
        and(
          eq(paceGroupMoveRequests.batchId, batchId),
          eq(paceGroupMoveRequests.profileId, profileId),
          eq(paceGroupMoveRequests.status, 'pending'),
        ),
      )
      .limit(1);

    if (existingPending) {
      throw new PlacementError(
        'ACTIVE_REQUEST_EXISTS',
        'A pending move request already exists for this member in this batch.',
      );
    }

    // 6. Insert new move request
    const [request] = await tx
      .insert(paceGroupMoveRequests)
      .values({
        batchId,
        profileId,
        fromPaceGroupId: currentActive ? currentActive.paceGroupId : null,
        toPaceGroupId,
        reason: reason ?? null,
        status: 'pending',
      })
      .returning();

    return request;
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runTransaction(tx));
  }

  return await runTransaction(executor);
}

/**
 * Retrieves all pending move requests for a batch with full member, preference, and group details.
 */
export async function getPendingMoveRequests(
  batchId: string,
  executor: DbOrTx = db,
): Promise<PendingMoveRequestItem[]> {
  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, batchId),
  });

  if (!batch) {
    throw new PlacementError(
      'BATCH_NOT_FOUND',
      `Batch '${batchId}' was not found.`,
    );
  }

  const fromPaceGroups = alias(paceGroups, 'from_pace_groups');
  const toPaceGroups = alias(paceGroups, 'to_pace_groups');

  const rows = await executor
    .select({
      id: paceGroupMoveRequests.id,
      profileId: paceGroupMoveRequests.profileId,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      userName: user.name,
      userEmail: user.email,
      appEmail: applications.email,
      profileTelegram: profiles.telegramUsername,
      appTelegram: applications.telegramUsername,
      profilePhone: profiles.phone,
      appPhone: applications.phoneNumber,
      appPacePreference: applications.paceGroup,
      currentPaceGroupId: fromPaceGroups.id,
      currentPaceGroupName: fromPaceGroups.name,
      requestedPaceGroupId: toPaceGroups.id,
      requestedPaceGroupName: toPaceGroups.name,
      requestedPaceGroupSize: toPaceGroups.size,
      status: paceGroupMoveRequests.status,
      reason: paceGroupMoveRequests.reason,
      createdAt: paceGroupMoveRequests.createdAt,
    })
    .from(paceGroupMoveRequests)
    .innerJoin(profiles, eq(profiles.id, paceGroupMoveRequests.profileId))
    .innerJoin(user, eq(user.id, profiles.authUserId))
    .leftJoin(
      applications,
      and(
        eq(applications.profileId, paceGroupMoveRequests.profileId),
        eq(applications.batchId, batchId),
      ),
    )
    .leftJoin(
      fromPaceGroups,
      eq(fromPaceGroups.id, paceGroupMoveRequests.fromPaceGroupId),
    )
    .innerJoin(
      toPaceGroups,
      eq(toPaceGroups.id, paceGroupMoveRequests.toPaceGroupId),
    )
    .where(
      and(
        eq(paceGroupMoveRequests.batchId, batchId),
        eq(paceGroupMoveRequests.status, 'pending'),
      ),
    )
    .orderBy(asc(paceGroupMoveRequests.createdAt));

  return rows.map((row) => ({
    id: row.id,
    profileId: row.profileId,
    name:
      [row.firstName, row.fatherName].filter(Boolean).join(' ') ||
      row.userName ||
      'Unknown Member',
    firstName: row.firstName,
    fatherName: row.fatherName,
    email: row.userEmail || row.appEmail || '',
    telegramUsername: row.profileTelegram || row.appTelegram || null,
    phoneNumber: row.profilePhone || row.appPhone || null,
    currentPaceGroupId: row.currentPaceGroupId ?? null,
    currentPaceGroupName: row.currentPaceGroupName ?? null,
    requestedPaceGroupId: row.requestedPaceGroupId,
    requestedPaceGroupName: row.requestedPaceGroupName,
    requestedPaceGroupSize: row.requestedPaceGroupSize,
    status: row.status,
    reason: row.reason,
    pacePreference: row.appPacePreference ?? null,
    createdAt: row.createdAt,
  }));
}

/**
 * Approves a pending move request in a single atomic transaction:
 * 1. Verifies move request exists and is pending.
 * 2. Verifies member has active batch enrollment.
 * 3. Verifies target group belongs to batch and is not archived.
 * 4. Closes existing active pace group membership if present.
 * 5. Inserts new active pace group membership.
 * 6. Inserts membership_move_audit record.
 * 7. Updates move request status to 'approved'.
 */
export async function approveMoveRequest(
  input: ApproveMoveRequestInput,
  actorProfileId: string,
  executor: DbOrTx = db,
): Promise<ApproveMoveRequestResult> {
  const { requestId, batchId, notes } = input;

  const runTransaction = async (tx: DbOrTx) => {
    // 1. Verify move request exists, belongs to batch, and is pending
    const [request] = await tx
      .select()
      .from(paceGroupMoveRequests)
      .where(
        and(
          eq(paceGroupMoveRequests.id, requestId),
          eq(paceGroupMoveRequests.batchId, batchId),
        ),
      )
      .limit(1);

    if (!request) {
      throw new PlacementError(
        'MOVE_REQUEST_NOT_FOUND',
        `Move request '${requestId}' was not found in this batch.`,
      );
    }

    if (request.status !== 'pending') {
      throw new PlacementError(
        'MOVE_REQUEST_NOT_PENDING',
        `Move request is already '${request.status}' and cannot be approved.`,
      );
    }

    // 2. Verify member still has active/grace enrollment in batch
    const [batchMembership] = await tx
      .select({ id: batchMemberships.id })
      .from(batchMemberships)
      .where(
        and(
          eq(batchMemberships.profileId, request.profileId),
          eq(batchMemberships.batchId, batchId),
          inArray(batchMemberships.status, ['active', 'grace']),
        ),
      )
      .limit(1);

    if (!batchMembership) {
      throw new PlacementError(
        'MEMBER_NOT_ENROLLED',
        'Member no longer has an active enrollment in this batch.',
      );
    }

    // 3. Verify target group belongs to batch and is not archived
    const [targetGroup] = await tx
      .select({
        id: paceGroups.id,
        batchId: paceGroups.batchId,
        archived: paceGroups.archived,
      })
      .from(paceGroups)
      .where(eq(paceGroups.id, request.toPaceGroupId))
      .limit(1);

    if (!targetGroup || targetGroup.batchId !== batchId) {
      throw new PlacementError(
        'PACE_GROUP_NOT_FOUND',
        'Target pace group does not exist in this batch.',
      );
    }

    if (targetGroup.archived) {
      throw new PlacementError(
        'PACE_GROUP_ARCHIVED',
        'Cannot move member to an archived pace group.',
      );
    }

    // 4. Verify current active membership
    const [currentActive] = await tx
      .select({
        id: paceGroupMemberships.id,
        paceGroupId: paceGroupMemberships.paceGroupId,
      })
      .from(paceGroupMemberships)
      .where(
        and(
          eq(paceGroupMemberships.profileId, request.profileId),
          eq(paceGroupMemberships.batchId, batchId),
          eq(paceGroupMemberships.status, 'active'),
        ),
      )
      .limit(1);

    const now = new Date();

    // 5. Close old active membership if present
    if (currentActive) {
      await tx
        .update(paceGroupMemberships)
        .set({
          status: 'switched',
          endDate: now,
          switchReason: request.reason || 'Move request approved',
        })
        .where(eq(paceGroupMemberships.id, currentActive.id));
    }

    // 6. Insert new active membership
    const [newMembership] = await tx
      .insert(paceGroupMemberships)
      .values({
        profileId: request.profileId,
        batchId,
        paceGroupId: request.toPaceGroupId,
        status: 'active',
        startDate: now,
      })
      .returning();

    // 7. Insert audit record
    const [audit] = await tx
      .insert(membershipMoveAudit)
      .values({
        profileId: request.profileId,
        fromPaceGroupId: currentActive ? currentActive.paceGroupId : null,
        toPaceGroupId: request.toPaceGroupId,
        moveReason: 'Approved move request',
        movedBy: actorProfileId,
        notes: notes ?? request.reason ?? null,
        moveDate: now,
      })
      .returning();

    // 8. Update move request record status to approved
    await tx
      .update(paceGroupMoveRequests)
      .set({
        status: 'approved',
        reviewedBy: actorProfileId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(paceGroupMoveRequests.id, requestId));

    return {
      requestId,
      previousMembershipId: currentActive ? currentActive.id : null,
      newMembership,
      audit,
      status: 'approved' as const,
    };
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runTransaction(tx));
  }

  return await runTransaction(executor);
}

/**
 * Rejects a pending move request without changing any group memberships.
 */
export async function rejectMoveRequest(
  input: RejectMoveRequestInput,
  actorProfileId: string,
  executor: DbOrTx = db,
): Promise<RejectMoveRequestResult> {
  const { requestId, batchId, rejectionReason } = input;

  const [request] = await executor
    .select({
      id: paceGroupMoveRequests.id,
      status: paceGroupMoveRequests.status,
    })
    .from(paceGroupMoveRequests)
    .where(
      and(
        eq(paceGroupMoveRequests.id, requestId),
        eq(paceGroupMoveRequests.batchId, batchId),
      ),
    )
    .limit(1);

  if (!request) {
    throw new PlacementError(
      'MOVE_REQUEST_NOT_FOUND',
      `Move request '${requestId}' was not found in this batch.`,
    );
  }

  if (request.status !== 'pending') {
    throw new PlacementError(
      'MOVE_REQUEST_NOT_PENDING',
      `Move request is already '${request.status}' and cannot be rejected.`,
    );
  }

  const now = new Date();

  await executor
    .update(paceGroupMoveRequests)
    .set({
      status: 'rejected',
      reviewedBy: actorProfileId,
      reviewedAt: now,
      rejectionReason: rejectionReason ?? null,
      updatedAt: now,
    })
    .where(eq(paceGroupMoveRequests.id, requestId));

  return {
    requestId,
    status: 'rejected',
    rejectionReason: rejectionReason ?? null,
  };
}

/**
 * Retrieves historical membership moves strictly scoped to a batch with search and pagination.
 */
export async function getBatchMoveHistory(
  input: GetMoveHistoryFilterInput,
  executor: DbOrTx = db,
): Promise<MoveHistoryResult> {
  const { batchId, page = 1, limit = 20, search } = input;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const offset = (page - 1) * safeLimit;

  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, batchId),
  });

  if (!batch) {
    throw new PlacementError(
      'BATCH_NOT_FOUND',
      `Batch '${batchId}' was not found.`,
    );
  }

  const fromPaceGroups = alias(paceGroups, 'hist_from_pace_groups');
  const toPaceGroups = alias(paceGroups, 'hist_to_pace_groups');
  const actorProfiles = alias(profiles, 'hist_actor_profiles');
  const actorUsers = alias(user, 'hist_actor_users');

  const conditions = [
    eq(toPaceGroups.batchId, batchId), // Strict batch scoping prevents cross-batch leakage
  ];

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(profiles.firstName, term),
        ilike(profiles.fatherName, term),
        ilike(user.name, term),
        ilike(user.email, term),
      )!,
    );
  }

  // Count total matching
  const [{ totalCount }] = await executor
    .select({ totalCount: count() })
    .from(membershipMoveAudit)
    .innerJoin(
      toPaceGroups,
      eq(toPaceGroups.id, membershipMoveAudit.toPaceGroupId),
    )
    .innerJoin(profiles, eq(profiles.id, membershipMoveAudit.profileId))
    .innerJoin(user, eq(user.id, profiles.authUserId))
    .where(and(...conditions));

  const total = Number(totalCount) || 0;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const rows = await executor
    .select({
      id: membershipMoveAudit.id,
      profileId: membershipMoveAudit.profileId,
      memberFirstName: profiles.firstName,
      memberFatherName: profiles.fatherName,
      memberUserName: user.name,
      memberEmail: user.email,
      fromPaceGroupId: fromPaceGroups.id,
      fromPaceGroupName: fromPaceGroups.name,
      toPaceGroupId: toPaceGroups.id,
      toPaceGroupName: toPaceGroups.name,
      moveReason: membershipMoveAudit.moveReason,
      movedById: actorProfiles.id,
      actorFirstName: actorProfiles.firstName,
      actorFatherName: actorProfiles.fatherName,
      actorUserName: actorUsers.name,
      moveDate: membershipMoveAudit.moveDate,
      notes: membershipMoveAudit.notes,
    })
    .from(membershipMoveAudit)
    .innerJoin(
      toPaceGroups,
      eq(toPaceGroups.id, membershipMoveAudit.toPaceGroupId),
    )
    .leftJoin(
      fromPaceGroups,
      eq(fromPaceGroups.id, membershipMoveAudit.fromPaceGroupId),
    )
    .innerJoin(profiles, eq(profiles.id, membershipMoveAudit.profileId))
    .innerJoin(user, eq(user.id, profiles.authUserId))
    .leftJoin(actorProfiles, eq(actorProfiles.id, membershipMoveAudit.movedBy))
    .leftJoin(actorUsers, eq(actorUsers.id, actorProfiles.authUserId))
    .where(and(...conditions))
    .orderBy(desc(membershipMoveAudit.moveDate))
    .limit(safeLimit)
    .offset(offset);

  const items: MoveHistoryItem[] = rows.map((row) => ({
    id: row.id,
    profileId: row.profileId,
    memberName:
      [row.memberFirstName, row.memberFatherName].filter(Boolean).join(' ') ||
      row.memberUserName ||
      'Unknown Member',
    memberEmail: row.memberEmail || '',
    fromPaceGroupId: row.fromPaceGroupId ?? null,
    fromPaceGroupName: row.fromPaceGroupName ?? null,
    toPaceGroupId: row.toPaceGroupId,
    toPaceGroupName: row.toPaceGroupName,
    moveReason: row.moveReason,
    movedById: row.movedById ?? null,
    movedByName:
      [row.actorFirstName, row.actorFatherName].filter(Boolean).join(' ') ||
      row.actorUserName ||
      null,
    moveDate: row.moveDate,
    notes: row.notes,
  }));

  return {
    batchId,
    page,
    limit: safeLimit,
    total,
    totalPages,
    items,
  };
}
