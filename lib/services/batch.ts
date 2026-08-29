import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { batches, batchAdmins, profiles } from "@/db/schema";
import type { CreateBatchInput } from "@/lib/validations/batch";

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = DbClient | DbTransaction;

export type BatchErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "BATCH_NOT_FOUND"
  | "ADMIN_NOT_FOUND"
  | "DUPLICATE_ADMIN"
  | "ADMIN_LIMIT_EXCEEDED"
  | "TRANSACTION_FAILED";

export class BatchError extends Error {
  code: BatchErrorCode;
  constructor(code: BatchErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "BatchError";
  }
}

/**
 * Resolves reading_days_per_week integer from Epic 12 cadence pacing type.
 */
export function resolveReadingDaysPerWeek(
  pacingType: CreateBatchInput["pacingType"],
  customDays?: number
): number {
  switch (pacingType) {
    case "daily":
      return 7;
    case "three_times_week":
      return 3;
    case "custom":
      return customDays && customDays >= 1 && customDays <= 7 ? customDays : 6;
    default:
      return 6;
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
  executor: DbOrTx = db
): Promise<CreateBatchResult> {
  if (input.maxMembers <= 0) {
    throw new BatchError(
      "INVALID_INPUT",
      "Max members must be a positive integer."
    );
  }

  if (input.paceGroupCount < 1) {
    throw new BatchError(
      "INVALID_INPUT",
      "Pace group count must be at least 1."
    );
  }

  const rawAdminIds =
    input.adminIds && input.adminIds.length > 0
      ? input.adminIds
      : [creatorProfileId];

  // Check for duplicate admin IDs
  const candidateAdminIds = Array.from(new Set(rawAdminIds));
  if (candidateAdminIds.length !== rawAdminIds.length) {
    throw new BatchError(
      "DUPLICATE_ADMIN",
      "The same user cannot be assigned to the same batch more than once."
    );
  }

  if (candidateAdminIds.length < 1) {
    throw new BatchError(
      "INVALID_INPUT",
      "At least one batch admin must be assigned."
    );
  }

  if (candidateAdminIds.length > 3) {
    throw new BatchError(
      "ADMIN_LIMIT_EXCEEDED",
      "A batch cannot have more than 3 assigned batch admins."
    );
  }

  const readingDays = resolveReadingDaysPerWeek(
    input.pacingType,
    input.readingDaysPerWeek
  );

  const formattedStartDate =
    input.startDate instanceof Date
      ? input.startDate.toISOString().split("T")[0]
      : String(input.startDate);

  // Execute in single transaction
  return await executor.transaction(async (tx) => {
    // Verify all candidate admin profiles exist
    const existingProfiles = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.id, candidateAdminIds));

    if (existingProfiles.length !== candidateAdminIds.length) {
      const foundIds = new Set(existingProfiles.map((p) => p.id));
      const missingIds = candidateAdminIds.filter((id) => !foundIds.has(id));
      throw new BatchError(
        "ADMIN_NOT_FOUND",
        `Admin profile(s) not found: ${missingIds.join(", ")}`
      );
    }

    // Insert batch in initial not-yet-open state
    const [newBatch] = await tx
      .insert(batches)
      .values({
        name: input.name.trim(),
        maxMembers: input.maxMembers,
        paceGroupCount: input.paceGroupCount,
        registrationOpen: false, // Initial/not-yet-open status
        autoApprove: true,
        startDate: formattedStartDate,
        readingDaysPerWeek: readingDays,
        createdBy: creatorProfileId,
      })
      .returning();

    if (!newBatch) {
      throw new BatchError("TRANSACTION_FAILED", "Failed to create batch record.");
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

export type AssignBatchAdminResult = {
  batchId: string;
  profileId: string;
  assignedAdminIds: string[];
};

/**
 * Assigns an accountable admin (batch_admin) to an existing batch.
 *
 * Rules:
 * - max_members must be > 0.
 * - pace_group_count must be >= 1.
 * - The same user cannot be assigned to the same batch more than once.
 * - A 4th admin assignment must be rejected with a clear error (max 3 admins).
 */
export async function assignBatchAdmin(
  batchId: string,
  profileId: string,
  executor: DbOrTx = db
): Promise<AssignBatchAdminResult> {
  return await executor.transaction(async (tx) => {
    // 1. Verify batch exists
    const [batch] = await tx
      .select()
      .from(batches)
      .where(eq(batches.id, batchId));

    if (!batch) {
      throw new BatchError("BATCH_NOT_FOUND", "Batch not found.");
    }

    // 2. Validate batch configuration constraints
    if (batch.maxMembers <= 0) {
      throw new BatchError(
        "INVALID_INPUT",
        "Batch max_members must be greater than 0."
      );
    }

    if (batch.paceGroupCount < 1) {
      throw new BatchError(
        "INVALID_INPUT",
        "Batch pace_group_count must be at least 1."
      );
    }

    // 3. Verify admin profile exists
    const [profile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profileId));

    if (!profile) {
      throw new BatchError(
        "ADMIN_NOT_FOUND",
        `Admin profile not found: ${profileId}`
      );
    }

    // 4. Fetch current assigned batch admins
    const existingAdmins = await tx
      .select({ profileId: batchAdmins.profileId })
      .from(batchAdmins)
      .where(eq(batchAdmins.batchId, batchId));

    const existingAdminIds = existingAdmins.map((a) => a.profileId);

    // 5. Duplicate check: same user cannot be assigned more than once
    if (existingAdminIds.includes(profileId)) {
      throw new BatchError(
        "DUPLICATE_ADMIN",
        "The same user cannot be assigned to the same batch more than once."
      );
    }

    // 6. Cardinality check: max 3 admins per batch, reject 4th admin
    if (existingAdminIds.length >= 3) {
      throw new BatchError(
        "ADMIN_LIMIT_EXCEEDED",
        "A batch cannot have more than 3 assigned batch admins. 4th admin assignment is rejected."
      );
    }

    // 7. Insert new admin assignment
    await tx.insert(batchAdmins).values({
      batchId,
      profileId,
    });

    return {
      batchId,
      profileId,
      assignedAdminIds: [...existingAdminIds, profileId],
    };
  });
}

/**
 * Gets all assigned admin profile IDs for a given batch.
 */
export async function getBatchAdmins(
  batchId: string,
  executor: DbOrTx = db
): Promise<string[]> {
  const records = await executor
    .select({ profileId: batchAdmins.profileId })
    .from(batchAdmins)
    .where(eq(batchAdmins.batchId, batchId));

  return records.map((r) => r.profileId);
}

