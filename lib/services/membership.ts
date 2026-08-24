import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  batchMemberships,
  type BatchMembershipStatus,
  BATCH_MEMBERSHIP_STATUSES,
} from "@/db/schema/batch-memberships";

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
 */
export async function transitionBatchMembership(
  membershipId: string,
  targetStatus: BatchMembershipStatus,
  reason?: string
) {
  if (!BATCH_MEMBERSHIP_STATUSES.includes(targetStatus)) {
    throw new MembershipError(
      "INVALID_STATUS",
      `Invalid membership target status '${targetStatus}'.`
    );
  }

  const existing = await db.query.batchMemberships.findFirst({
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

  const [updated] = await db
    .update(batchMemberships)
    .set({
      status: targetStatus,
      endDate: isTerminal ? new Date() : existing.endDate,
      removalReason: reason ?? existing.removalReason,
    })
    .where(eq(batchMemberships.id, membershipId))
    .returning();

  return updated;
}
