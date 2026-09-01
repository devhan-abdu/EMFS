import "server-only";

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";

export type Role = "super_admin" | "batch_admin" | "pace_admin" | "member";

export class AuthzError extends Error {
  code: "UNAUTHENTICATED" | "FORBIDDEN";
  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
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
    throw new AuthzError("UNAUTHENTICATED", "You must be signed in.");
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

  const minRequiredRank = Math.min(...allowed.map((r) => ROLE_RANK[r]));
  if (ROLE_RANK[role] < minRequiredRank) {
    throw new AuthzError(
      "FORBIDDEN",
      `Role '${role}' is not permitted. Required at least: ${allowed.join(", ")}.`
    );
  }
  return user;
}

/**
 * Super admin authorization guard for catalog mutations (book creation, pairing, reordering).
 * Only super_admin rank is permitted (rank 3).
 */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  return requireRole(["super_admin"]);
}

/** Formats an AuthzError into the standard FieldError structure used across actions. */
export function authzErrorToFieldError(error: AuthzError) {
  return {
    field: "auth",
    message: error.message,
    code: error.code,
  };
}