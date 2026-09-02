import { eq, or, and, ilike, notInArray, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { profiles, batchAdmins, user, batches } from "@/db/schema";
import type { SearchProfilesInput } from "@/lib/validations/user-search";

export type { SearchProfilesInput };

export type AdminPickerUser = {
  id: string; // profiles.id (UUID used for admin assignment)
  name: string;
  email: string;
  role: string;
};

export type ProfileSearchResult = {
  profileId: string;
  displayName: string;
  email: string;
};

export type KnownBatchAdminBatch = {
  id: string;
  name: string;
};

export type KnownBatchAdmin = {
  profileId: string;
  displayName: string;
  email: string;
  adminOfBatches: KnownBatchAdminBatch[];
};

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = DbClient | DbTransaction;

export type UserSearchErrorCode =
  | "INVALID_QUERY"
  | "INVALID_INPUT"
  | "UNAUTHORIZED";

export class UserSearchError extends Error {
  code: UserSearchErrorCode;
  constructor(code: UserSearchErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "UserSearchError";
  }
}

/**
 * EMF-58: Searches all profiles across the system joining profiles + user.
 * Supports:
 * - query: must be at least 2 characters, matches displayName (firstName, fatherName, full name, user.name) and user.email case-insensitively
 * - limit: max 25 results, defaults to 25
 * - excludeProfileIds: excludes specified profile UUIDs
 * - No filter on profiles.role or previous admin status
 * - Returns only profileId, displayName, and email
 */
export async function searchProfiles(
  input: SearchProfilesInput | string,
  executor: DbOrTx = db
): Promise<ProfileSearchResult[]> {
  const normalizedInput: SearchProfilesInput =
    typeof input === "string" ? { query: input, limit: 25, excludeProfileIds: [] } : input;

  const trimmedQuery = normalizedInput.query ? normalizedInput.query.trim() : "";
  if (trimmedQuery.length < 2) {
    throw new UserSearchError(
      "INVALID_QUERY",
      "Search query must be at least 2 characters."
    );
  }

  const requestedLimit = normalizedInput.limit ?? 25;
  const effectiveLimit = Math.min(Math.max(1, requestedLimit), 25);

  const pattern = `%${trimmedQuery}%`;

  const nameOrEmailCondition = or(
    ilike(user.name, pattern),
    ilike(user.email, pattern),
    ilike(profiles.firstName, pattern),
    ilike(profiles.fatherName, pattern),
    sql`concat(${profiles.firstName}, ' ', ${profiles.fatherName}) ILIKE ${pattern}`
  );

  const conditions = [nameOrEmailCondition];

  if (
    normalizedInput.excludeProfileIds &&
    normalizedInput.excludeProfileIds.length > 0
  ) {
    conditions.push(notInArray(profiles.id, normalizedInput.excludeProfileIds));
  }

  const rows = await executor
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      userName: user.name,
      email: user.email,
    })
    .from(profiles)
    .innerJoin(user, eq(profiles.authUserId, user.id))
    .where(and(...conditions))
    .limit(effectiveLimit);

  return rows.map((r) => ({
    profileId: r.id,
    displayName: (r.userName || `${r.firstName} ${r.fatherName}`).trim(),
    email: r.email,
  }));
}

/**
 * Sub-issue 1: Retrieves distinct profiles that have previously been assigned
 * as batch admins in any batch.
 */
export async function getPreviouslyAssignedBatchAdmins(
  executor: DbOrTx = db
): Promise<AdminPickerUser[]> {
  const rows = await executor
    .selectDistinct({
      id: profiles.id,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      userName: user.name,
      email: user.email,
      role: profiles.role,
    })
    .from(batchAdmins)
    .innerJoin(profiles, eq(batchAdmins.profileId, profiles.id))
    .innerJoin(user, eq(profiles.authUserId, user.id));

  return rows.map((r) => ({
    id: r.id,
    name: (r.userName || `${r.firstName} ${r.fatherName}`).trim(),
    email: r.email,
    role: r.role,
  }));
}

/**
 * Sub-issue 2: Searches all users across the system by matching against
 * user.name, user.email, profiles.firstName, or profiles.fatherName.
 */
export async function searchUsers(
  query: string,
  executor: DbOrTx = db
): Promise<AdminPickerUser[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const pattern = `%${trimmed}%`;

  const rows = await executor
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      userName: user.name,
      email: user.email,
      role: profiles.role,
    })
    .from(profiles)
    .innerJoin(user, eq(profiles.authUserId, user.id))
    .where(
      or(
        ilike(user.name, pattern),
        ilike(user.email, pattern),
        ilike(profiles.firstName, pattern),
        ilike(profiles.fatherName, pattern)
      )
    )
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    name: (r.userName || `${r.firstName} ${r.fatherName}`).trim(),
    email: r.email,
    role: r.role,
  }));
}

/**
 * Lists distinct profiles from batch_admins, ordered by the most recent
 * batch admin assignment (createdAt desc), capped at 20 distinct profiles.
 * Includes adminOfBatches[] with batch id and name for context.
 */
export async function listKnownBatchAdmins(
  executor: DbOrTx = db
): Promise<KnownBatchAdmin[]> {
  const rows = await executor
    .select({
      profileId: profiles.id,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      userName: user.name,
      email: user.email,
      batchId: batches.id,
      batchName: batches.name,
      assignedAt: batchAdmins.createdAt,
    })
    .from(batchAdmins)
    .innerJoin(profiles, eq(batchAdmins.profileId, profiles.id))
    .innerJoin(user, eq(profiles.authUserId, user.id))
    .innerJoin(batches, eq(batchAdmins.batchId, batches.id))
    .orderBy(desc(batchAdmins.createdAt));

  const profileMap = new Map<string, KnownBatchAdmin>();

  for (const row of rows) {
    let profile = profileMap.get(row.profileId);
    if (!profile) {
      if (profileMap.size >= 20) {
        continue;
      }
      const displayName = (row.userName || `${row.firstName} ${row.fatherName}`).trim();
      profile = {
        profileId: row.profileId,
        displayName,
        email: row.email,
        adminOfBatches: [],
      };
      profileMap.set(row.profileId, profile);
    }

    if (!profile.adminOfBatches.some((b) => b.id === row.batchId)) {
      profile.adminOfBatches.push({
        id: row.batchId,
        name: row.batchName,
      });
    }
  }

  return Array.from(profileMap.values());
}

