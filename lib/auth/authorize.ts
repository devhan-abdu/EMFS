import 'server-only';

import { getCurrentUser, type CurrentUser } from '@/lib/auth/session';
import { db } from '@/db';
import { batchAdmins } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export type Role = 'super_admin' | 'batch_admin' | 'pace_admin' | 'member';

export class AuthzError extends Error {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN';
  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN', message: string) {
    super(message);
    this.code = code;
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
  console.log(role, 'what is the role it register ');
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

/** Formats an AuthzError into the standard FieldError structure used across actions. */
export function authzErrorToFieldError(error: AuthzError) {
  return {
    field: 'auth',
    message: error.message,
    code: error.code,
  };
}
