import { eq, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { profiles, batchAdmins, user } from "@/db/schema";

export type AdminPickerUser = {
  id: string; // profiles.id (UUID used for admin assignment)
  name: string;
  email: string;
  role: string;
};

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = DbClient | DbTransaction;

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
