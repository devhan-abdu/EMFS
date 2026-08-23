import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { applications, batches } from "@/db/schema";
import type { CreateApplicationInput } from "@/lib/validations/application";

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

  // Check if target batch exists
  const existingBatch = await db.query.batches.findFirst({
    where: eq(batches.id, input.batchId),
  });

  if (!existingBatch) {
    throw new ApplicationError(
      "BATCH_NOT_FOUND",
      `Batch with ID '${input.batchId}' not found.`
    );
  }

  // Check if user has already applied for this batch
  const existingApp = await db.query.applications.findFirst({
    where: and(
      eq(applications.userId, userId),
      eq(applications.batchId, input.batchId)
    ),
  });

  if (existingApp) {
    throw new ApplicationError(
      "ALREADY_APPLIED",
      "User has already submitted an application for this batch."
    );
  }

  const [inserted] = await db
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
    .returning();

  return inserted;
}
