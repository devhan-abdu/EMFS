import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications, batches, batchMemberships } from "@/db/schema";
import type { CreateApplicationInput } from "@/lib/validations/application";
import {
  createBatchMembership,
  NON_TERMINAL_STATUSES,
} from "@/lib/services/membership";

export type ApplicationErrorCode =
  | "EMAIL_MISMATCH"
  | "BATCH_NOT_FOUND"
  | "ALREADY_APPLIED"
  | "INVALID_INPUT";

export class ApplicationError extends Error {
  code: ApplicationErrorCode;
  constructor(code: ApplicationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ApplicationError";
  }
}

/**
 * Creates a new application record for an authenticated user.
 * Strictly verifies that the submitted email matches the authenticated user's account email.
 * Ensures non-terminal membership eligibility and atomically creates the batch membership record.
 */
export async function createApplication(
  userId: string,
  authEmail: string,
  input: CreateApplicationInput
) {
  // EMAIL SECURITY REQUIREMENT: Email must match authenticated user account email
  if (input.email.trim().toLowerCase() !== authEmail.trim().toLowerCase()) {
    throw new ApplicationError(
      "EMAIL_MISMATCH",
      "Submitted email does not match authenticated user email."
    );
  }

  return await db.transaction(async (tx) => {
    // Check if target batch exists
    const existingBatch = await tx.query.batches.findFirst({
      where: eq(batches.id, input.batchId),
    });

    if (!existingBatch) {
      throw new ApplicationError(
        "BATCH_NOT_FOUND",
        `Batch with ID '${input.batchId}' not found.`
      );
    }

    // Check if user currently has an active / non-terminal membership for this batch
    const existingNonTerminal = await tx.query.batchMemberships.findFirst({
      where: and(
        eq(batchMemberships.profileId, userId),
        eq(batchMemberships.batchId, input.batchId),
        inArray(batchMemberships.status, [...NON_TERMINAL_STATUSES])
      ),
    });

    if (existingNonTerminal) {
      throw new ApplicationError(
        "ALREADY_APPLIED",
        "User has already submitted an application for this batch."
      );
    }

    // Upsert application row preserving historical record on conflict
    const [inserted] = await tx
      .insert(applications)
      .values({
        userId,
        batchId: input.batchId,
        registrationName: input.registrationName,
        email: input.email,
        telegramUsername: input.telegramUsername,
        phoneNumber: input.phoneNumber,
        paceGroup: input.paceGroup,
      })
      .onConflictDoUpdate({
        target: [applications.userId, applications.batchId],
        set: {
          registrationName: input.registrationName,
          email: input.email,
          telegramUsername: input.telegramUsername,
          phoneNumber: input.phoneNumber,
          paceGroup: input.paceGroup,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Create batch membership with status "applied"
    await createBatchMembership(userId, input.batchId, "applied", tx);

    return inserted;
  });
}
