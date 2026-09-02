import "server-only"
import { eq, or, and, ilike, notInArray, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { profiles, batchAdmins, user, batches } from "@/db/schema";
import type {
  SearchProfilesInput,
  ProfileSearchResult,
  KnownBatchAdminBatch,
} from "@/lib/validations/user-search";
export type { SearchProfilesInput };



export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = DbClient | DbTransaction;

export type UserSearchErrorCode =
  | "INVALID_QUERY"
  | "INVALID_INPUT"
  | "UNAUTHORIZED";

export class UserSearchError extends Error {
  constructor(
    public code: "DB_ERROR",
    message: string,
    public cause?: unknown,
  ) {
    super(message);
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
  input: SearchProfilesInput,
  executor: DbOrTx = db
): Promise<ProfileSearchResult[]> {
  // action send normalized input
  const trimmedQuery = input.query.trim();
  if (trimmedQuery.length < 2) return [];



  const requestedLimit = input.limit ?? 25;
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

   if (input.excludeProfileIds.length > 0) {
     conditions.push(notInArray(profiles.id, input.excludeProfileIds));
   }

  try {
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
  } catch (cause) {
    throw new UserSearchError("DB_ERROR", "Failed to search profiles", cause);
  }
}

/**
 * Sub-issue 1: Retrieves distinct profiles that have previously been assigned
 * as batch admins in any batch.
 */
// also join batch name 
export async function getPreviouslyAssignedBatchAdmins(
  executor: DbOrTx = db,
): Promise<ProfileSearchResult[]> {
  try {
    const rows = await executor
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        fatherName: profiles.fatherName,
        userName: user.name,
        email: user.email,
        adminOfBatches: sql<KnownBatchAdminBatch[]>`
          jsonb_agg(distinct jsonb_build_object('id', ${batches.id}, 'name', ${batches.name}))
        `,
      })
      .from(batchAdmins)
      .innerJoin(profiles, eq(batchAdmins.profileId, profiles.id))
      .innerJoin(user, eq(profiles.authUserId, user.id))
      .innerJoin(batches, eq(batchAdmins.batchId, batches.id))
      .groupBy(
        profiles.id,
        profiles.firstName,
        profiles.fatherName,
        user.name,
        user.email,
    )
      .limit(20);

    return rows.map((r) => ({
      profileId: r.id,
      displayName: (r.userName || `${r.firstName} ${r.fatherName}`).trim(),
      email: r.email,
      adminOfBatches: r.adminOfBatches,
    }));
  } catch (cause) {
    throw new UserSearchError(
      "DB_ERROR",
      "Failed to load previously assigned batch admins",
      cause,
    );
  }
}

