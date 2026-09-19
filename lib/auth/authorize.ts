import 'server-only';

import { getCurrentUser, type CurrentUser } from '@/lib/auth/session';
import { db } from '@/db';
import { batchAdmins, paceAdminAssignments, paceGroups } from '@/db/schema';
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

const ROLE_RANK: Record<Role, number> = {
  member: 0,
  pace_admin: 1,
  batch_admin: 2,
  super_admin: 3,
};

/** Any signed-in user is fine — just confirms someone's actually logged in. */
export async function requireSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthzError('UNAUTHENTICATED', 'You must be signed in.');
  }
  return user;
}

/**
 * Role must be at or above the lowest rank in `allowed` — e.g.
 * requireRole(["pace_admin"]) also lets a batch_admin or super_admin
 * through, since higher roles can do everything a lower role can (US-ADM-04).
 */
export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await requireSession();
  const role = user.profile.role as Role;

  if (!allowed.includes(role)) {
    throw new AuthzError(
      'FORBIDDEN',
      `Role '${role}' is not permitted. Required one of: ${allowed.join(', ')}.`,
    );
  }
  return user;
}

export async function requireMinRole(minimum: Role): Promise<CurrentUser> {
  const user = await requireSession();
  const role = user.profile.role as Role;
  if (ROLE_RANK[role] < ROLE_RANK[minimum]) {
    throw new AuthzError('FORBIDDEN', `Requires at least '${minimum}' role.`);
  }
  return user;
}

/**
 * Super admin authorization guard for catalog mutations (book creation, pairing, reordering).
 * Only super_admin rank is permitted (rank 3).
 */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  return requireRole(['super_admin']);
}

/**
 * Batch-scoped authorization: super_admin always passes; batch_admin only
 * passes if assigned to THIS batch (batch_admins table). Prevents a batch
 * admin from one batch touching another batch's pace groups.
 */
export async function requireBatchAccess(
  batchId: string,
): Promise<CurrentUser> {
  const user = await requireRole(['batch_admin', 'super_admin']);
  if (user.profile.role === 'super_admin') return user;

  const assignment = await db.query.batchAdmins.findFirst({
    where: and(
      eq(batchAdmins.batchId, batchId),
      eq(batchAdmins.profileId, user.profile.id),
    ),
  });

  if (!assignment) {
    throw new AuthzError(
      'FORBIDDEN',
      'You are not an assigned admin for this batch.',
    );
  }
  return user;
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
  const user = await requireRole(['pace_admin', 'batch_admin', 'super_admin']);
  if (user.profile.role === 'super_admin') return user;

  const group = await db.query.paceGroups.findFirst({
    where: eq(paceGroups.id, paceGroupId),
  });

  if (!group) {
    throw new AuthzError('FORBIDDEN', 'Pace group not found.');
  }

  if (user.profile.role === 'batch_admin') {
    const batchAssignment = await db.query.batchAdmins.findFirst({
      where: and(
        eq(batchAdmins.batchId, group.batchId),
        eq(batchAdmins.profileId, user.profile.id),
      ),
    });

    if (!batchAssignment) {
      throw new AuthzError(
        'FORBIDDEN',
        'You are not an assigned admin for this batch.',
      );
    }
    return user;
  }

  const paceAssignment = await db.query.paceAdminAssignments.findFirst({
    where: and(
      eq(paceAdminAssignments.paceGroupId, paceGroupId),
      eq(paceAdminAssignments.profileId, user.profile.id),
    ),
  });

  if (!paceAssignment) {
    throw new AuthzError(
      'FORBIDDEN',
      'You are not an assigned admin for this pace group.',
    );
  }

  return user;
}

/**
 * Resolves the authorized batch IDs for a given user.
 * Returns 'all' for super_admin, or an array of string batch IDs for batch_admin / pace_admin.
 */
export async function getAuthorizedBatchIds(
  user: CurrentUser,
): Promise<string[] | 'all'> {
  if (user.profile.role === 'super_admin') return 'all';

  if (user.profile.role === 'batch_admin') {
    const assignments = await db.query.batchAdmins.findMany({
      where: eq(batchAdmins.profileId, user.profile.id),
    });
    return assignments.map((a) => a.batchId);
  }

  if (user.profile.role === 'pace_admin') {
    const assignments = await db.query.paceAdminAssignments.findMany({
      where: eq(paceAdminAssignments.profileId, user.profile.id),
    });
    if (assignments.length === 0) return [];
    const groupIds = assignments.map((a) => a.paceGroupId);
    const groups = await db.query.paceGroups.findMany({
      where: inArray(paceGroups.id, groupIds),
    });
    return Array.from(new Set(groups.map((g) => g.batchId)));
  }

  return [];
}

/**
 * Resolves the authorized pace group IDs for a given user.
 * Returns 'all' for super_admin, or an array of string pace group IDs for batch_admin / pace_admin.
 */
export async function getAuthorizedPaceGroupIds(
  user: CurrentUser,
): Promise<string[] | 'all'> {
  if (user.profile.role === 'super_admin') return 'all';

  if (user.profile.role === 'batch_admin') {
    const batchAssignments = await db.query.batchAdmins.findMany({
      where: eq(batchAdmins.profileId, user.profile.id),
    });
    if (batchAssignments.length === 0) return [];
    const batchIds = batchAssignments.map((a) => a.batchId);
    const groups = await db.query.paceGroups.findMany({
      where: inArray(paceGroups.batchId, batchIds),
    });
    return groups.map((g) => g.id);
  }

  if (user.profile.role === 'pace_admin') {
    const assignments = await db.query.paceAdminAssignments.findMany({
      where: eq(paceAdminAssignments.profileId, user.profile.id),
    });
    return assignments.map((a) => a.paceGroupId);
  }

  return [];
}

/** Formats an AuthzError into the standard FieldError structure used across actions. */
export function authzErrorToFieldError(error: AuthzError) {
  return {
    field: 'auth',
    message: error.message,
    code: error.code,
  };
}
