import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  batchMemberships,
  type BatchMembershipStatus,
  BATCH_MEMBERSHIP_STATUSES,
  membershipAuditLogs,
} from "@/db/schema";

export type MembershipErrorCode =
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "ALREADY_EXISTS"
  | "INVALID_STATUS";

export class MembershipError extends Error {
  code: MembershipErrorCode;
  constructor(code: MembershipErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "MembershipError";
  }
}

/**
 * Non-terminal statuses where a member is actively part of, or progressing through intake for, a batch.
 */
export const NON_TERMINAL_STATUSES: readonly BatchMembershipStatus[] = [
  "waitlisted",
  "applied",
  "approved",
  "active",
  "grace",
] as const;

/**
 * Strict state machine transition table.
 */
export const ALLOWED_TRANSITIONS: Record<
  BatchMembershipStatus,
  readonly BatchMembershipStatus[]
> = {
  waitlisted: ["applied"],
  applied: ["approved", "rejected"],
  approved: ["active"],
  rejected: [],
  active: ["grace", "removed"],
  grace: ["active", "removed"],
  removed: [],
};

/**
 * Checks if a transition from `from` state to `to` state is permitted.
 */
export function isValidTransition(
  from: BatchMembershipStatus,
  to: BatchMembershipStatus
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Creates a new batch membership record for a profile in a batch.
 * Enforces that a member cannot have two non-terminal (active/applied/waitlisted/approved/grace)
 * membership records for the SAME batch at the same time.
 */
export async function createBatchMembership(
  profileId: string,
  batchId: string,
  status: BatchMembershipStatus = "applied"
) {
  if (!BATCH_MEMBERSHIP_STATUSES.includes(status)) {
    throw new MembershipError(
      "INVALID_STATUS",
      `Invalid membership status '${status}'.`
    );
  }

  // Check for existing non-terminal membership in the SAME batch
  const existingActive = await db.query.batchMemberships.findFirst({
    where: and(
      eq(batchMemberships.profileId, profileId),
      eq(batchMemberships.batchId, batchId),
      inArray(batchMemberships.status, [...NON_TERMINAL_STATUSES])
    ),
  });

  if (existingActive) {
    throw new MembershipError(
      "ALREADY_EXISTS",
      `Member already has an active or pending membership (status: '${existingActive.status}') in this batch.`
    );
  }

  try {
    const [inserted] = await db
      .insert(batchMemberships)
      .values({
        profileId,
        batchId,
        status,
      })
      .returning();

    return inserted;
  } catch (error) {
    if (error instanceof MembershipError) {
      throw error;
    }
    throw error;
  }
}

/**
 * Transitions an existing batch membership to a target status according to the state machine.
 * Sinks transition state update and audit log creation into a single atomic transaction.
 */
export async function transitionBatchMembership(
  membershipId: string,
  targetStatus: BatchMembershipStatus,
  reason?: string,
  actorId?: string
) {
  if (!BATCH_MEMBERSHIP_STATUSES.includes(targetStatus)) {
    throw new MembershipError(
      "INVALID_STATUS",
      `Invalid membership target status '${targetStatus}'.`
    );
  }

  return await db.transaction(async (tx) => {
    const existing = await tx.query.batchMemberships.findFirst({
      where: eq(batchMemberships.id, membershipId),
    });

    if (!existing) {
      throw new MembershipError(
        "NOT_FOUND",
        `Batch membership with ID '${membershipId}' not found.`
      );
    }

    const currentStatus = existing.status as BatchMembershipStatus;

    if (!isValidTransition(currentStatus, targetStatus)) {
      throw new MembershipError(
        "INVALID_TRANSITION",
        `Cannot transition membership status from '${currentStatus}' to '${targetStatus}'.`
      );
    }

    const isTerminal = targetStatus === "removed" || targetStatus === "rejected";

    const [updated] = await tx
      .update(batchMemberships)
      .set({
        status: targetStatus,
        endDate: isTerminal ? new Date() : existing.endDate,
        removalReason: reason ?? existing.removalReason,
      })
      .where(eq(batchMemberships.id, membershipId))
      .returning();

    // If an authenticated actor ID is provided, record exactly one audit log entry atomically
    if (actorId) {
      await tx.insert(membershipAuditLogs).values({
        memberId: existing.profileId,
        fromState: currentStatus,
        toState: targetStatus,
        fromBatchId: existing.batchId,
        toBatchId: existing.batchId,
        actorId,
        reason: reason || `Transitioned status from '${currentStatus}' to '${targetStatus}'.`,
        timestamp: new Date(),
      });
    }

    return updated;
  });
}

/**
 * Moves a batch membership from one batch to another.
 * Records audit row with from_batch_id and to_batch_id atomically.
 */
export async function moveBatchMembership(
  membershipId: string,
  newBatchId: string,
  actorId: string,
  reason: string
) {
  if (!reason || reason.trim().length === 0) {
    throw new MembershipError(
      "INVALID_TRANSITION",
      "Reason is required for batch move."
    );
  }

  return await db.transaction(async (tx) => {
    const existing = await tx.query.batchMemberships.findFirst({
      where: eq(batchMemberships.id, membershipId),
    });

    if (!existing) {
      throw new MembershipError(
        "NOT_FOUND",
        `Batch membership with ID '${membershipId}' not found.`
      );
    }

    if (existing.batchId === newBatchId) {
      throw new MembershipError(
        "INVALID_TRANSITION",
        "Target batch must be different from current batch."
      );
    }

    const currentStatus = existing.status as BatchMembershipStatus;

    const [updated] = await tx
      .update(batchMemberships)
      .set({
        batchId: newBatchId,
      })
      .where(eq(batchMemberships.id, membershipId))
      .returning();

    await tx.insert(membershipAuditLogs).values({
      memberId: existing.profileId,
      fromState: currentStatus,
      toState: currentStatus,
      fromBatchId: existing.batchId,
      toBatchId: newBatchId,
      actorId,
      reason,
      timestamp: new Date(),
    });

    return updated;
  });
}

/**
 * Re-enters a previously removed member into a new or same batch.
 * Records audit row with from_state = 'removed' and to_state = targetStatus atomically.
 */
export async function reenterBatchMembership(
  profileId: string,
  fromBatchId: string,
  toBatchId: string,
  targetStatus: BatchMembershipStatus,
  actorId: string,
  reason: string
) {
  if (!BATCH_MEMBERSHIP_STATUSES.includes(targetStatus)) {
    throw new MembershipError(
      "INVALID_STATUS",
      `Invalid membership target status '${targetStatus}'.`
    );
  }

  if (!reason || reason.trim().length === 0) {
    throw new MembershipError(
      "INVALID_TRANSITION",
      "Reason is required for member re-entry."
    );
  }

  return await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(batchMemberships)
      .values({
        profileId,
        batchId: toBatchId,
        status: targetStatus,
      })
      .returning();

    await tx.insert(membershipAuditLogs).values({
      memberId: profileId,
      fromState: "removed",
      toState: targetStatus,
      fromBatchId,
      toBatchId,
      actorId,
      reason,
      timestamp: new Date(),
    });

    return inserted;
  });
}
