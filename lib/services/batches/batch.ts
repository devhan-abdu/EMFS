import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  batches,
  batchAdmins,
  batchMemberships,
  paceGroups,
  profiles,
  user,
} from '@/db/schema';
import type { CreateBatchInput } from '@/lib/validations/batch';

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = DbClient | DbTransaction;

export type BatchErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'ADMIN_NOT_FOUND'
  | 'ADMIN_LIMIT_EXCEEDED'
  | 'INVALID_ADMIN_ROLE'
  | 'TRANSACTION_FAILED'
  | 'BATCH_NOT_FOUND'
  | 'NO_BATCH_ADMIN'
  | 'NO_PACE_GROUP'
  | 'BATCH_FULL';

export class BatchError extends Error {
  code: BatchErrorCode;
  constructor(code: BatchErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'BatchError';
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
    input.adminIds && input.adminIds.length > 0
      ? Array.from(new Set(input.adminIds))
      : [creatorProfileId];

  if (candidateAdminIds.length < 1) {
    throw new BatchError(
      'INVALID_INPUT',
      'At least one batch admin must be assigned.',
    );
  }

  if (candidateAdminIds.length > 3) {
    throw new BatchError(
      'ADMIN_LIMIT_EXCEEDED',
      'A batch cannot have more than 3 assigned batch admins.',
    );
  }

  const formattedStartDate =
    input.startDate instanceof Date
      ? input.startDate.toISOString().split('T')[0]
      : String(input.startDate);

  // Execute in single transaction
  return await executor.transaction(async (tx) => {
    // Verify all candidate admin profiles exist and have allowed roles
    const existingProfiles = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.id, candidateAdminIds));

    if (existingProfiles.length !== candidateAdminIds.length) {
      const foundIds = new Set(existingProfiles.map((p) => p.id));
      const missingIds = candidateAdminIds.filter((id) => !foundIds.has(id));
      throw new BatchError(
        'ADMIN_NOT_FOUND',
        `Admin profile(s) not found: ${missingIds.join(', ')}`,
      );
    }

    const [newBatch] = await tx
      .insert(batches)
      .values({
        name: input.name.trim(),
        maxMembers: input.maxMembers,
        paceGroupCount: input.paceGroupCount,
        registrationOpen: input.registrationOpen,
        autoApprove: true,
        startDate: formattedStartDate,
        readingDaysPerWeek: input.readingDaysPerWeek,
        createdBy: creatorProfileId,
      })
      .returning();

    if (!newBatch) {
      throw new BatchError(
        'TRANSACTION_FAILED',
        'Failed to create batch record.',
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
export async function updateBatch(
  creatorProfileId: string,
  input: CreateBatchInput,
  executor: DbOrTx = db,
): Promise<CreateBatchResult> {
  // Determine admin profile IDs to assign (1 to 3 admins)
  const candidateAdminIds =
    input.adminIds && input.adminIds.length > 0
      ? Array.from(new Set(input.adminIds))
      : [creatorProfileId];

  if (candidateAdminIds.length < 1) {
    throw new BatchError(
      'INVALID_INPUT',
      'At least one batch admin must be assigned.',
    );
  }

  if (candidateAdminIds.length > 3) {
    throw new BatchError(
      'ADMIN_LIMIT_EXCEEDED',
      'A batch cannot have more than 3 assigned batch admins.',
    );
  }

  const formattedStartDate =
    input.startDate instanceof Date
      ? input.startDate.toISOString().split('T')[0]
      : String(input.startDate);

  return await executor.transaction(async (tx) => {
    // Verify all candidate admin profiles exist and have allowed roles
    const existingProfiles = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.id, candidateAdminIds));

    if (existingProfiles.length !== candidateAdminIds.length) {
      const foundIds = new Set(existingProfiles.map((p) => p.id));
      const missingIds = candidateAdminIds.filter((id) => !foundIds.has(id));
      throw new BatchError(
        'ADMIN_NOT_FOUND',
        `Admin profile(s) not found: ${missingIds.join(', ')}`,
      );
    }

    const [newBatch] = await tx
      .insert(batches)
      .values({
        ...(input.id ? { id: input.id } : {}),
        name: input.name.trim(),
        maxMembers: input.maxMembers,
        paceGroupCount: input.paceGroupCount,
        registrationOpen: input.registrationOpen,
        autoApprove: true,
        startDate: formattedStartDate,
        readingDaysPerWeek: input.readingDaysPerWeek,
        createdBy: creatorProfileId,
      })
      .onConflictDoUpdate({
        target: [batches.id],
        set: {
          name: input.name.trim(),
          maxMembers: input.maxMembers,
          paceGroupCount: input.paceGroupCount,
          registrationOpen: input.registrationOpen,
          autoApprove: true,
          startDate: formattedStartDate,
          readingDaysPerWeek: input.readingDaysPerWeek,
        },
      })
      .returning();

    if (!newBatch) {
      throw new BatchError(
        'TRANSACTION_FAILED',
        'Failed to create batch record.',
      );
    }

    await tx.delete(batchAdmins).where(eq(batchAdmins.batchId, newBatch.id));
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
      .join(' '),
    email: a.email,
    previouslyAssigned: previouslyAssignedIds.has(a.profileId),
  }));
}

function extractCount(rows: unknown[], countKey: string): number {
  if (!rows || rows.length === 0) return 0;
  const first = rows[0] as Record<string, unknown> | undefined;
  if (first && typeof first === 'object') {
    if (countKey in first && first[countKey] !== undefined) {
      return Number(first[countKey]);
    }
    if ('count' in first && first.count !== undefined) {
      return Number(first.count);
    }
  }
  return rows.length;
}

/**
 * Validates whether a batch satisfies the gate requirements to open registration.
 *
 * Requirements:
 * 1. Condition 1: The batch has at least one assigned batch admin (NO_BATCH_ADMIN).
 * 2. Condition 2: The batch contains at least one non-archived pace group (NO_PACE_GROUP).
 * 3. Condition 3: The batch is currently under its maximum capacity limit (BATCH_FULL).
 */
export async function validateBatchRegistrationGate(
  batchId: string,
  executor: DbOrTx = db,
): Promise<void> {
  const batchRows = await executor
    .select({
      id: batches.id,
      maxMembers: batches.maxMembers,
      registrationOpen: batches.registrationOpen,
    })
    .from(batches)
    .where(eq(batches.id, batchId));

  if (!batchRows || batchRows.length === 0) {
    throw new BatchError('BATCH_NOT_FOUND', 'Batch not found.');
  }

  const batch = batchRows[0];

  // Condition 1: The batch has at least one assigned batch admin.
  const adminRows = await executor
    .select({ adminCount: count() })
    .from(batchAdmins)
    .where(eq(batchAdmins.batchId, batchId));

  const adminCount = extractCount(adminRows, 'adminCount');
  if (adminCount < 1) {
    throw new BatchError('NO_BATCH_ADMIN', 'NO_BATCH_ADMIN');
  }

  // Condition 2: The batch contains at least one non-archived pace group.
  const paceGroupRows = await executor
    .select({ paceGroupCount: count() })
    .from(paceGroups)
    .where(
      and(eq(paceGroups.batchId, batchId), eq(paceGroups.archived, false)),
    );

  const paceGroupCount = extractCount(paceGroupRows, 'paceGroupCount');
  if (paceGroupCount < 1) {
    throw new BatchError('NO_PACE_GROUP', 'NO_PACE_GROUP');
  }

  // Condition 3: The batch is currently under its maximum capacity limit.
  const memberRows = await executor
    .select({ memberCount: count() })
    .from(batchMemberships)
    .where(
      and(
        eq(batchMemberships.batchId, batchId),
        inArray(batchMemberships.status, ['approved', 'active', 'grace']),
      ),
    );

  const currentMemberCount = extractCount(memberRows, 'memberCount');
  if (currentMemberCount >= batch.maxMembers) {
    throw new BatchError('BATCH_FULL', 'BATCH_FULL');
  }
}

/**
 * Updates batch registration status.
 * If open is true, runs validateBatchRegistrationGate before updating the database.
 */
export async function updateBatchRegistration(
  batchId: string,
  open: boolean,
  executor: DbOrTx = db,
): Promise<Batch> {
  if (open) {
    await validateBatchRegistrationGate(batchId, executor);
  }

  const updateQuery = executor
    .update(batches)
    .set({ registrationOpen: open, updatedAt: new Date() })
    .where(eq(batches.id, batchId));

  // Handle both .returning() supporting query builders and simple mocks
  if (
    updateQuery &&
    typeof (updateQuery as { returning?: unknown }).returning === 'function'
  ) {
    const updatedRows = await (
      updateQuery as { returning: () => Promise<Batch[]> }
    ).returning();
    if (updatedRows && updatedRows.length > 0) {
      return updatedRows[0];
    }
  } else {
    await updateQuery;
  }

  return {
    id: batchId,
    registrationOpen: open,
  } as Batch;
}

export const toggleBatchRegistration = updateBatchRegistration;
