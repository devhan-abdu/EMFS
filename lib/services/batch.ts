import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { batches, batchAdmins, profiles, user } from "@/db/schema";
import type { CreateBatchInput } from "@/lib/validations/batch";

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = DbClient | DbTransaction;

export type BatchErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "ADMIN_NOT_FOUND"
  | "ADMIN_LIMIT_EXCEEDED"
  | "INVALID_ADMIN_ROLE"
  | "TRANSACTION_FAILED";

export class BatchError extends Error {
  code: BatchErrorCode;
  constructor(code: BatchErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "BatchError";
  }
}

export type CreateBatchResult = {
  batch: Batch;
  assignedAdminIds: string[];
};

/**
 * Creates a fully configured not-yet-open batch and assigns 1-3 batch admins
 * inside a single database transaction.
 *
 * If admin assignment fails, the entire batch creation rolls back.
 */
export async function createBatch(
  creatorProfileId: string,
  input: CreateBatchInput,
  executor: DbOrTx = db,
): Promise<CreateBatchResult> {
  // Determine admin profile IDs to assign (1 to 3 admins)
  const candidateAdminIds =
    input.adminIds && input.adminIds.length > 0 ?
      Array.from(new Set(input.adminIds))
    : [creatorProfileId];

  if (candidateAdminIds.length < 1) {
    throw new BatchError(
      "INVALID_INPUT",
      "At least one batch admin must be assigned.",
    );
  }

  if (candidateAdminIds.length > 3) {
    throw new BatchError(
      "ADMIN_LIMIT_EXCEEDED",
      "A batch cannot have more than 3 assigned batch admins.",
    );
  }

  const formattedStartDate =
    input.startDate instanceof Date ?
      input.startDate.toISOString().split("T")[0]
    : String(input.startDate);

  // Execute in single transaction
  return await executor.transaction(async (tx) => {
    // Verify all candidate admin profiles exist and have allowed roles
    const existingProfiles = await tx
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(inArray(profiles.id, candidateAdminIds));

    if (existingProfiles.length !== candidateAdminIds.length) {
      const foundIds = new Set(existingProfiles.map((p) => p.id));
      const missingIds = candidateAdminIds.filter((id) => !foundIds.has(id));
      throw new BatchError(
        "ADMIN_NOT_FOUND",
        `Admin profile(s) not found: ${missingIds.join(", ")}`,
      );
    }

    const ALLOWED_ADMIN_ROLES = new Set([
      "super_admin",
      "batch_admin",
      "pace_admin",
      "member",
    ]);
    const invalidRoleProfile = existingProfiles.find(
      (p) => !ALLOWED_ADMIN_ROLES.has(p.role),
    );
    if (invalidRoleProfile) {
      throw new BatchError(
        "INVALID_ADMIN_ROLE",
        `Profile '${invalidRoleProfile.id}' has invalid role '${invalidRoleProfile.role}' for batch admin assignment.`,
      );
    }

    // Insert batch in initial not-yet-open state
    const [newBatch] = await tx
      .insert(batches)
      .values({
        name: input.name.trim(),
        maxMembers: input.maxMembers,
        paceGroupCount: input.paceGroupCount,
        registrationOpen: input.registrationOpen,
        autoApprove: input.requireTelegramHandoff,
        startDate: formattedStartDate,
        readingDaysPerWeek: input.readingDaysPerWeek,
        createdBy: creatorProfileId,
      })
      .returning();

    if (!newBatch) {
      throw new BatchError(
        "TRANSACTION_FAILED",
        "Failed to create batch record.",
      );
    }

    // Assign initial batch admins
    for (const adminId of candidateAdminIds) {
      await tx.insert(batchAdmins).values({
        batchId: newBatch.id,
        profileId: adminId,
      });
    }

    return {
      batch: newBatch,
      assignedAdminIds: candidateAdminIds,
    };
  });
}


export type AdminOption = {
  profileId: string;
  displayName: string;
  email: string;
  previouslyAssigned: boolean;
};

const ELIGIBLE_ADMIN_ROLES = [
  "super_admin",
  "batch_admin",
  "pace_admin",
] as const;

export async function getEligibleBatchAdmins(
  executor: DbOrTx = db,
): Promise<AdminOption[]> {
  const [eligible, assigned] = await Promise.all([
    executor
      .select({
        profileId: profiles.id,
        firstName: profiles.firstName,
        fatherName: profiles.fatherName,
        grandfatherName: profiles.grandfatherName,
        email: user.email,
      })
      .from(profiles)
      .innerJoin(user, eq(profiles.authUserId, user.id))
      .where(inArray(profiles.role, ELIGIBLE_ADMIN_ROLES))
      .orderBy(profiles.firstName, profiles.fatherName),
    executor
      .selectDistinct({ profileId: batchAdmins.profileId })
      .from(batchAdmins),
  ]);

  const previouslyAssignedIds = new Set(assigned.map((a) => a.profileId));

  return eligible.map((a) => ({
    profileId: a.profileId,
    displayName: [a.firstName, a.fatherName, a.grandfatherName]
      .filter(Boolean)
      .join(" "),
    email: a.email,
    previouslyAssigned: previouslyAssignedIds.has(a.profileId),
  }));
}
