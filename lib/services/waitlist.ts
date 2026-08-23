import { eq, and, sql, asc, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { waitlist, batches } from "@/db/schema";

export type WaitlistErrorCode =
  | "BATCH_NOT_FOUND"
  | "ALREADY_WAITLISTED"
  | "NOT_FOUND"
  | "FORBIDDEN";

export class WaitlistError extends Error {
  code: WaitlistErrorCode;
  constructor(code: WaitlistErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "WaitlistError";
  }
}

/**
 * Adds a user to the waitlist for a specific batch.
 * Computes the next 1-based queue_position for the batch atomically.
 * Locks the batch row FOR UPDATE to prevent race conditions during concurrent insertions.
 */
export async function addToWaitlist(userId: string, batchId: string) {
  return await db.transaction(async (tx) => {
    // Acquire exclusive row lock on batch to serialize concurrent insertions per batch
    const [existingBatch] = await tx
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, batchId))
      .for("update");

    if (!existingBatch) {
      throw new WaitlistError(
        "BATCH_NOT_FOUND",
        `Batch with ID '${batchId}' not found.`
      );
    }

    const existingWaitlist = await tx.query.waitlist.findFirst({
      where: and(
        eq(waitlist.batchId, batchId),
        eq(waitlist.userId, userId)
      ),
    });

    if (existingWaitlist) {
      throw new WaitlistError(
        "ALREADY_WAITLISTED",
        "User is already on the waitlist for this batch."
      );
    }

    const maxPosResult = await tx
      .select({ maxPos: sql<number>`COALESCE(MAX(${waitlist.queuePosition}), 0)` })
      .from(waitlist)
      .where(eq(waitlist.batchId, batchId));

    const nextPos = Number(maxPosResult[0]?.maxPos ?? 0) + 1;

    const [inserted] = await tx
      .insert(waitlist)
      .values({
        batchId,
        userId,
        queuePosition: nextPos,
      })
      .returning();

    return inserted;
  });
}

/**
 * Removes an entry from the waitlist and re-compacts subsequent queue positions
 * in the same batch to guarantee strict, unambiguous ordering.
 * Enforces ownership / admin authorization.
 */
export async function removeFromWaitlist(
  waitlistId: string,
  requestingProfileId: string,
  requestingRole?: string
) {
  return await db.transaction(async (tx) => {
    const existing = await tx.query.waitlist.findFirst({
      where: eq(waitlist.id, waitlistId),
    });

    if (!existing) {
      throw new WaitlistError(
        "NOT_FOUND",
        `Waitlist entry with ID '${waitlistId}' not found.`
      );
    }

    const isOwner = existing.userId === requestingProfileId;
    const isAdmin =
      requestingRole === "batch_admin" || requestingRole === "super_admin";

    if (!isOwner && !isAdmin) {
      throw new WaitlistError(
        "FORBIDDEN",
        "You are not authorized to remove this waitlist entry."
      );
    }

    // Lock batch row to serialize queue position updates
    await tx
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, existing.batchId))
      .for("update");

    await tx.delete(waitlist).where(eq(waitlist.id, waitlistId));

    // Pass 1: Negate positions for entries after the deleted position to clear positive index values
    await tx
      .update(waitlist)
      .set({
        queuePosition: sql`-${waitlist.queuePosition}`,
      })
      .where(
        and(
          eq(waitlist.batchId, existing.batchId),
          gt(waitlist.queuePosition, existing.queuePosition)
        )
      );

    // Pass 2: Re-assign final compacted positive positions from negated values
    await tx
      .update(waitlist)
      .set({
        queuePosition: sql`(-${waitlist.queuePosition}) - 1`,
      })
      .where(
        and(
          eq(waitlist.batchId, existing.batchId),
          lt(waitlist.queuePosition, 0)
        )
      );

    return existing;
  });
}

/**
 * Returns the #1 person in line for a given batch.
 */
export async function getWaitlistHead(batchId: string) {
  const [head] = await db
    .select()
    .from(waitlist)
    .where(eq(waitlist.batchId, batchId))
    .orderBy(asc(waitlist.queuePosition))
    .limit(1);

  return head ?? null;
}

/**
 * Retrieves the full ordered queue for a batch.
 */
export async function getWaitlistQueue(batchId: string) {
  return await db
    .select()
    .from(waitlist)
    .where(eq(waitlist.batchId, batchId))
    .orderBy(asc(waitlist.queuePosition));
}

