import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  batchMemberships,
  batches,
  paceGroupMemberships,
  paceGroups,
  tasks,
  books,
  batchPacingOffsets,
  dailyProgress,
} from "@/db/schema";
import type { DbOrTx } from "@/lib/services/membership";
import { requireSession } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import {
  toggleDailyProgressInputSchema,
  type ToggleDailyProgressInput,
} from "@/lib/validations/daily-progress";

export type ProgressErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NO_ACTIVE_BATCH"
  | "NO_ACTIVE_PACE_GROUP"
  | "TASK_NOT_FOUND"
  | "TASK_NOT_PUBLISHED"
  | "BATCH_NOT_STARTED"
  | "TASK_GROUP_MISMATCH";

export class DailyProgressError extends Error {
  code: ProgressErrorCode;
  constructor(code: ProgressErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DailyProgressError";
  }
}

/** Formats Date or ISO string into canonical YYYY-MM-DD */
export function formatDateKey(date: Date | string): string {
  if (typeof date === "string") {
    return date.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/** Adds calendar days to a YYYY-MM-DD string without timezone or hour drift */
export function addCalendarDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates the effective publication date for a curriculum task `dayNumber` in a batch,
 * taking into account batch start date, weekly reading cadence, and schedule pacing offsets.
 */
export function calculateTaskEffectiveDate(
  batchStartDate: string,
  dayNumber: number,
  readingDaysPerWeek = 6,
  offsets: Array<{ effectiveFromDayNumber: number; offsetDays: number }> = [],
): string {
  if (dayNumber < 1) {
    throw new DailyProgressError(
      "INVALID_INPUT",
      `Day number must be positive (received ${dayNumber}).`,
    );
  }

  const cadence = Math.max(1, Math.min(7, readingDaysPerWeek));

  // Step 1 is active on batchStartDate (day offset = 0).
  // For step n >= 1, we account for cadence rest days:
  const stepOffset = dayNumber - 1;
  const fullWeeks = Math.floor(stepOffset / cadence);
  const remainingDays = stepOffset % cadence;
  const calendarDayOffset = fullWeeks * 7 + remainingDays;

  let effectiveDate = addCalendarDays(batchStartDate, calendarDayOffset);

  // Apply relevant pacing offsets (offsets effective at or before this dayNumber)
  const totalOffsetDays = offsets
    .filter((o) => o.effectiveFromDayNumber <= dayNumber)
    .reduce((sum, o) => sum + o.offsetDays, 0);

  if (totalOffsetDays !== 0) {
    effectiveDate = addCalendarDays(effectiveDate, totalOffsetDays);
  }

  return effectiveDate;
}

/**
 * Resolves a member's current active batch membership and batch record.
 * Throws DailyProgressError("NO_ACTIVE_BATCH", ...) if no active membership is found.
 */
export async function getMemberActiveBatch(
  profileId: string,
  executor: DbOrTx = db,
) {
  const activeMembership = await executor.query.batchMemberships.findFirst({
    where: and(
      eq(batchMemberships.profileId, profileId),
      eq(batchMemberships.status, "active"),
    ),
  });

  if (!activeMembership) {
    throw new DailyProgressError(
      "NO_ACTIVE_BATCH",
      "Member does not have an active batch membership.",
    );
  }

  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, activeMembership.batchId),
  });

  if (!batch) {
    throw new DailyProgressError(
      "NO_ACTIVE_BATCH",
      `Batch '${activeMembership.batchId}' not found.`,
    );
  }

  return {
    membership: activeMembership,
    batch,
  };
}

/**
 * Resolves a member's current active pace group membership and pace group record for a given batch.
 * Throws DailyProgressError("NO_ACTIVE_PACE_GROUP", ...) if no active pace group is found.
 */
export async function getMemberActivePaceGroup(
  profileId: string,
  batchId: string,
  executor: DbOrTx = db,
) {
  const activeGroupMemberships =
    await executor.query.paceGroupMemberships.findMany({
      where: and(
        eq(paceGroupMemberships.profileId, profileId),
        eq(paceGroupMemberships.status, "active"),
      ),
    });

  if (activeGroupMemberships.length === 0) {
    throw new DailyProgressError(
      "NO_ACTIVE_PACE_GROUP",
      "Member is not assigned to any active pace group.",
    );
  }

  // Find the pace group that belongs to the active batch
  for (const groupMembership of activeGroupMemberships) {
    const paceGroup = await executor.query.paceGroups.findFirst({
      where: and(
        eq(paceGroups.id, groupMembership.paceGroupId),
        eq(paceGroups.batchId, batchId),
      ),
    });

    if (paceGroup) {
      return {
        membership: groupMembership,
        paceGroup,
      };
    }
  }

  throw new DailyProgressError(
    "NO_ACTIVE_PACE_GROUP",
    "Member does not have an active pace group assignment in their active batch.",
  );
}

export type ProgressValidationContext = {
  profileId: string;
  batchId: string;
  batch: typeof batches.$inferSelect;
  paceGroupId: string;
  paceGroup: typeof paceGroups.$inferSelect;
  taskId: string;
  task: typeof tasks.$inferSelect;
  book: typeof books.$inferSelect;
  effectiveDate: string;
  isPublished: boolean;
  localDate: string;
};

/**
 * Validates all domain and security preconditions before a member can check or mutate daily progress:
 * 1. Actor identity is authoritative (profileId from authenticated session).
 * 2. Member has an active batch membership.
 * 3. Member has an active pace-group membership belonging to that batch.
 * 4. Requested task exists in the master curriculum.
 * 5. Batch has already started on or before the reference local date.
 * 6. Task has reached its calculated effective publication date on the batch schedule.
 */
export async function validateDailyProgressEligibility(
  profileId: string,
  taskId: string,
  referenceLocalDate?: string,
  executor: DbOrTx = db,
): Promise<ProgressValidationContext> {
  if (!profileId || profileId.trim().length === 0) {
    throw new DailyProgressError(
      "UNAUTHENTICATED",
      "Authoritative member profile ID is required.",
    );
  }

  if (!taskId || taskId.trim().length === 0) {
    throw new DailyProgressError("INVALID_INPUT", "Task ID is required.");
  }

  const localDate = referenceLocalDate
    ? formatDateKey(referenceLocalDate)
    : formatDateKey(new Date());

  // 1. Resolve active batch membership
  const { batch } = await getMemberActiveBatch(profileId, executor);

  if (!batch.startDate) {
    throw new DailyProgressError(
      "BATCH_NOT_STARTED",
      `Batch '${batch.name}' has not been configured with a start date.`,
    );
  }

  const batchStartDate = formatDateKey(batch.startDate);

  // 2. Resolve active pace group in this batch
  const { paceGroup } = await getMemberActivePaceGroup(
    profileId,
    batch.id,
    executor,
  );

  // 3. Resolve master curriculum task and book
  const task = await executor.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!task) {
    throw new DailyProgressError(
      "TASK_NOT_FOUND",
      `Task with ID '${taskId}' was not found.`,
    );
  }

  const book = await executor.query.books.findFirst({
    where: eq(books.id, task.bookId),
  });

  if (!book) {
    throw new DailyProgressError(
      "TASK_NOT_FOUND",
      `Book associated with task '${taskId}' was not found.`,
    );
  }

  // 4. Fetch any pacing offsets configured for this batch
  const offsets = await executor.query.batchPacingOffsets.findMany({
    where: eq(batchPacingOffsets.batchId, batch.id),
    orderBy: [asc(batchPacingOffsets.effectiveFromDayNumber)],
  });

  // 5. Calculate task effective date and publication status
  const effectiveDate = calculateTaskEffectiveDate(
    batchStartDate,
    task.dayNumber,
    batch.readingDaysPerWeek,
    offsets,
  );

  if (batchStartDate > localDate) {
    throw new DailyProgressError(
      "BATCH_NOT_STARTED",
      `Batch '${batch.name}' has not started yet (scheduled to start on ${batchStartDate}, today is ${localDate}).`,
    );
  }

  if (effectiveDate > localDate) {
    throw new DailyProgressError(
      "TASK_NOT_PUBLISHED",
      `Task for day ${task.dayNumber} is scheduled for ${effectiveDate}, which is unpublished for current date ${localDate}.`,
    );
  }

  return {
    profileId,
    batchId: batch.id,
    batch,
    paceGroupId: paceGroup.id,
    paceGroup,
    taskId: task.id,
    task,
    book,
    effectiveDate,
    isPublished: true,
    localDate,
  };
}

/**
 * Authoritatively resolves the authenticated member and validates progress mutation eligibility.
 *
 * Security Invariants:
 * 1. Actor identity is derived strictly from the server-side HTTP-only session (`requireSession()`).
 * 2. Unauthenticated requests are rejected immediately.
 * 3. Client-provided `memberId`, `profileId`, `userId`, `batchId`, or `paceGroupId` in raw inputs are ignored/stripped.
 * 4. All batch and pace group relationships are derived from database truth for the authenticated user.
 */
export async function resolveAuthoritativeProgressContext(
  input: unknown,
  executor: DbOrTx = db,
): Promise<ProgressValidationContext & { actor: CurrentUser }> {
  // 1. Authenticated server session is the sole authority
  const currentUser = await requireSession();

  // 2. Validate client input schema (extracts only taskId, status, localDate)
  const parsed = toggleDailyProgressInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DailyProgressError(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message || "Invalid daily progress input payload.",
    );
  }

  // 3. Perform domain validation using strictly the session profile ID
  const validationContext = await validateDailyProgressEligibility(
    currentUser.profile.id,
    parsed.data.taskId,
    parsed.data.localDate,
    executor,
  );

  return {
    ...validationContext,
    actor: currentUser,
  };
}

export type SetDailyProgressInput = {
  taskId: string;
  status: "done" | "not_done";
  localDate?: string;
};

export type ProgressMutationResult = {
  progress: typeof dailyProgress.$inferSelect;
  previousStatus: "done" | "not_done" | null;
  statusChanged: boolean;
};

/**
 * Idempotently records or updates a daily progress record for a verified profile ID.
 *
 * Invariants:
 * 1. Executes domain validation within the transaction.
 * 2. Uses PostgreSQL ON CONFLICT (profile_id, task_id) DO UPDATE to guarantee idempotency and concurrency safety.
 * 3. Preserves completedAt if already done on repeated DONE requests.
 * 4. Sets completedAt to null if transitioned to not_done.
 * 5. Exactly one record exists per member per task.
 */
export async function recordDailyProgressForProfile(
  profileId: string,
  input: SetDailyProgressInput,
  executor: DbOrTx = db,
): Promise<ProgressMutationResult> {
  const targetStatus = input.status;
  if (targetStatus !== "done" && targetStatus !== "not_done") {
    throw new DailyProgressError(
      "INVALID_INPUT",
      `Invalid progress status '${targetStatus}'. Must be 'done' or 'not_done'.`,
    );
  }

  const runMutation = async (tx: DbOrTx) => {
    // 1. Perform domain & schedule validation
    const context = await validateDailyProgressEligibility(
      profileId,
      input.taskId,
      input.localDate,
      tx,
    );

    // 2. Read current existing record (if any) to calculate previous status
    const existing = await tx.query.dailyProgress.findFirst({
      where: and(
        eq(dailyProgress.profileId, profileId),
        eq(dailyProgress.taskId, input.taskId),
      ),
    });

    const previousStatus = existing ? (existing.status as "done" | "not_done") : null;
    const statusChanged = previousStatus !== targetStatus;
    const now = new Date();

    // Determine completedAt timestamp
    let completedAt: Date | null = null;
    if (targetStatus === "done") {
      completedAt =
        previousStatus === "done" && existing?.completedAt
          ? existing.completedAt
          : now;
    } else {
      completedAt = null;
    }

    // 3. Perform atomic upsert with ON CONFLICT (profileId, taskId)
    const [record] = await tx
      .insert(dailyProgress)
      .values({
        profileId,
        batchId: context.batchId,
        paceGroupId: context.paceGroupId,
        taskId: context.taskId,
        status: targetStatus,
        completedAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [dailyProgress.profileId, dailyProgress.taskId],
        set: {
          batchId: context.batchId,
          paceGroupId: context.paceGroupId,
          status: targetStatus,
          completedAt,
          updatedAt: now,
        },
      })
      .returning();

    return {
      progress: record,
      previousStatus,
      statusChanged,
    };
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runMutation(tx));
  }

  return await runMutation(executor);
}

/**
 * High-level mutation entry point that derives the actor from the authenticated server session
 * and performs the idempotent daily progress mutation.
 */
export async function recordDailyProgress(
  input: unknown,
  executor: DbOrTx = db,
): Promise<ProgressMutationResult & { actor: CurrentUser }> {
  // 1. Authoritative session retrieval
  const currentUser = await requireSession();

  // 2. Validate client input payload
  const parsed = toggleDailyProgressInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DailyProgressError(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message || "Invalid daily progress input payload.",
    );
  }

  // 3. Mutate strictly for the authenticated member profile
  const result = await recordDailyProgressForProfile(
    currentUser.profile.id,
    {
      taskId: parsed.data.taskId,
      status: parsed.data.status,
      localDate: parsed.data.localDate,
    },
    executor,
  );

  return {
    ...result,
    actor: currentUser,
  };
}

/**
 * Queries a member's progress record for a given task.
 */
export async function getDailyProgressForProfile(
  profileId: string,
  taskId: string,
  executor: DbOrTx = db,
) {
  return await executor.query.dailyProgress.findFirst({
    where: and(
      eq(dailyProgress.profileId, profileId),
      eq(dailyProgress.taskId, taskId),
    ),
  });
}
