import 'server-only';

import { getCurrentUser, type CurrentUser } from '@/lib/auth/session';
import { db } from '@/db';
import {
  batchAdmins,
  batches,
  batchMemberships,
  paceAdminAssignments,
  paceGroupMoveRequests,
  paceGroups,
} from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export type Role = 'super_admin' | 'batch_admin' | 'pace_admin' | 'member';

export class AuthzError extends Error {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN';
  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN', message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthzError';
  }
}

function forbidden(message: string): never {
  throw new AuthzError('FORBIDDEN', message);
}

const hasAnyBatchAdminGrant = async (profileId: string) =>
  Boolean(
    await db.query.batchAdmins.findFirst({
      where: eq(batchAdmins.profileId, profileId),
    }),
  );

const hasAnyPaceAdminGrant = async (profileId: string) =>
  Boolean(
    await db.query.paceAdminAssignments.findFirst({
      where: eq(paceAdminAssignments.profileId, profileId),
    }),
  );

const isBatchAdminOf = async (profileId: string, batchId: string) =>
  Boolean(
    await db.query.batchAdmins.findFirst({
      where: and(
        eq(batchAdmins.batchId, batchId),
        eq(batchAdmins.profileId, profileId),
      ),
    }),
  );

const isPaceAdminOf = async (profileId: string, paceGroupId: string) =>
  Boolean(
    await db.query.paceAdminAssignments.findFirst({
      where: and(
        eq(paceAdminAssignments.paceGroupId, paceGroupId),
        eq(paceAdminAssignments.profileId, profileId),
      ),
    }),
  );

const hasActiveMembership = async (profileId: string) =>
  Boolean(
    await db.query.batchMemberships.findFirst({
      where: and(
        eq(batchMemberships.profileId, profileId),
        inArray(batchMemberships.status, ['active', 'grace']),
      ),
    }),
  );

async function loadPaceGroupOrThrow(paceGroupId: string) {
  const group = await db.query.paceGroups.findFirst({
    where: eq(paceGroups.id, paceGroupId),
  });
  if (!group) forbidden('Pace group not found.');
  return group;
}

async function getAssignments(profileId: string) {
  const [batchRows, paceRows] = await Promise.all([
    db.query.batchAdmins.findMany({
      where: eq(batchAdmins.profileId, profileId),
    }),
    db.query.paceAdminAssignments.findMany({
      where: eq(paceAdminAssignments.profileId, profileId),
    }),
  ]);
  return {
    batchIds: Array.from(new Set(batchRows.map((r) => r.batchId))),
    paceGroupIds: Array.from(new Set(paceRows.map((r) => r.paceGroupId))),
  };
}

export async function requireSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthzError('UNAUTHENTICATED', 'You must be signed in.');
  }
  return user;
}

/** Checks each requested grant independently; grants do not imply each other. */
export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await requireSession();
  const profileId = user.profile.id;

  if (allowed.includes('super_admin') && user.profile.isSuperAdmin) {
    return user;
  }

  const [assignments, isActiveMember] = await Promise.all([
    getAssignments(profileId),
    hasActiveMembership(profileId),
  ]);

  const checks: Record<Role, () => boolean> = {
    super_admin: () => user.profile.isSuperAdmin,
    batch_admin: () => assignments.batchIds.length > 0,
    pace_admin: () => assignments.paceGroupIds.length > 0,
    member: () => isActiveMember,
  };

  const results = allowed.map((role) => checks[role]());
  if (!results.some(Boolean)) {
    forbidden(`Required one of the following grants: ${allowed.join(', ')}.`);
  }
  return user;
}

/**
 * Super admin authorization guard for catalog mutations (book creation, pairing, reordering).
 * Only super_admin rank is permitted (rank 3).
 */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireSession();
  if (!user.profile.isSuperAdmin) {
    forbidden('Requires global super-admin access.');
  }
  return user;
}

/**
 * Batch-scoped authorization: super_admin always passes; batch_admin only
 * passes if assigned to THIS batch (batch_admins table). Prevents a batch
 * admin from one batch touching another batch's pace groups.
 */
export async function requireBatchAccess(
  batchId: string,
): Promise<CurrentUser> {
  const user = await requireSession();
  if (user.profile.isSuperAdmin) return user;

  if (!(await isBatchAdminOf(user.profile.id, batchId))) {
    forbidden('You are not an assigned admin for this batch.');
  }
  return user;
}

export async function requireBatchAccessForPaceGroup(
  paceGroupId: string,
  expectedBatchId?: string,
): Promise<CurrentUser> {
  const group = await loadPaceGroupOrThrow(paceGroupId);
  if (expectedBatchId && group.batchId !== expectedBatchId) {
    forbidden('The pace group does not belong to the requested batch.');
  }

  await requireSession();
  return requireBatchAccess(group.batchId);
}

export async function requireBatchAccessForMoveRequest(
  requestId: string,
  expectedBatchId?: string,
): Promise<CurrentUser> {
  await requireSession(); // authenticate before revealing whether the request exists
  const request = await db.query.paceGroupMoveRequests.findFirst({
    where: eq(paceGroupMoveRequests.id, requestId),
  });
  if (!request) forbidden('Move request not found.');

  const targetGroup = await db.query.paceGroups.findFirst({
    where: eq(paceGroups.id, request.toPaceGroupId),
  });
  if (!targetGroup || targetGroup.batchId !== request.batchId) {
    forbidden('The move request has an invalid batch scope.');
  }
  if (expectedBatchId && targetGroup.batchId !== expectedBatchId) {
    forbidden('The move request does not belong to the requested batch.');
  }
  return requireBatchAccess(targetGroup.batchId);
}

/**
 * Pace-group-scoped authorization:
 * - super_admin always passes.
 * - batch_admin passes if assigned to the batch that owns this pace group.
 * - pace_admin passes if assigned to THIS pace group (pace_admin_assignments table).
 */
export async function requirePaceGroupAccess(
  paceGroupId: string,
): Promise<CurrentUser> {
  const user = await requireSession();
  const group = await loadPaceGroupOrThrow(paceGroupId);

  if (user.profile.isSuperAdmin) return user;
  if (await isBatchAdminOf(user.profile.id, group.batchId)) return user;
  if (await isPaceAdminOf(user.profile.id, paceGroupId)) return user;

  forbidden('You are not assigned to this batch or pace group.');
}

/** Any assignment grants access to the admin workspace picker. */
export async function requireAdminAccess(): Promise<CurrentUser> {
  const user = await requireSession();
  if (user.profile.isSuperAdmin) return user;

  const [isBatchAdmin, isPaceAdmin] = await Promise.all([
    hasAnyBatchAdminGrant(user.profile.id),
    hasAnyPaceAdminGrant(user.profile.id),
  ]);
  if (!isBatchAdmin && !isPaceAdmin) {
    forbidden('An admin assignment is required.');
  }
  return user;
}

/* -------------------------------------------------------------------------- */
/* Scope resolution — IDs (for authorization checks)                          */
/* -------------------------------------------------------------------------- */

/**
 * Authorized batch IDs. 'all' for super admins, otherwise directly assigned batches.
 * Use for authorization checks. For UI pickers use getAuthorizedBatchOptions.
 */
export async function getAuthorizedBatchIds(
  user: CurrentUser,
): Promise<string[] | 'all'> {
  if (user.profile.isSuperAdmin) return 'all';
  return (await getAssignments(user.profile.id)).batchIds;
}

/**
 * Authorized pace group IDs. 'all' for super admins, otherwise the union of
 * groups in assigned batches and directly assigned pace groups.
 * Use for authorization checks. For UI pickers use getAuthorizedPaceGroupOptions.
 */
export async function getAuthorizedPaceGroupIds(
  user: CurrentUser,
): Promise<string[] | 'all'> {
  if (user.profile.isSuperAdmin) return 'all';

  const { batchIds, paceGroupIds } = await getAssignments(user.profile.id);
  const groupsInBatches = batchIds.length
    ? await db.query.paceGroups.findMany({
        where: inArray(paceGroups.batchId, batchIds),
      })
    : [];

  return Array.from(
    new Set([...groupsInBatches.map((g) => g.id), ...paceGroupIds]),
  );
}

/* -------------------------------------------------------------------------- */
/* Scope resolution — options (for UI scope pickers / filters)                */
/* -------------------------------------------------------------------------- */

export type BatchOption = { id: string; name: string };
export type PaceGroupOption = { id: string; name: string; batchId: string };

export async function getAuthorizedBatchOptions(
  user: CurrentUser,
): Promise<BatchOption[]> {
  const ids = await getAuthorizedBatchIds(user);
  if (ids !== 'all' && ids.length === 0) return [];

  const rows = await db.query.batches.findMany({
    where: ids === 'all' ? undefined : inArray(batches.id, ids),
  });
  return rows.map(({ id, name }) => ({ id, name }));
}

export async function getAuthorizedPaceGroupOptions(
  user: CurrentUser,
): Promise<PaceGroupOption[]> {
  const ids = await getAuthorizedPaceGroupIds(user);
  if (ids !== 'all' && ids.length === 0) return [];

  const rows = await db.query.paceGroups.findMany({
    where: ids === 'all' ? undefined : inArray(paceGroups.id, ids),
  });
  return rows.map(({ id, name, batchId }) => ({ id, name, batchId }));
}

/** Formats an AuthzError into the standard FieldError structure used across actions. */
export function authzErrorToFieldError(error: AuthzError) {
  return {
    field: 'auth',
    message: error.message,
    code: error.code,
  };
}
