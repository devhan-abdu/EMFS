import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { handoffRecords, applications } from "@/db/schema";

export type HandoffErrorCode = "NOT_FOUND" | "ALREADY_EXISTS" | "INVALID_INPUT";

export class HandoffError extends Error {
  code: HandoffErrorCode;
  constructor(code: HandoffErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "HandoffError";
  }
}

const ALPHANUMERIC_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generates a cryptographically secure alphanumeric code.
 * @param length Desired code length (default 6)
 */
export function generateHandoffCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = bytes[i] % ALPHANUMERIC_CHARS.length;
    code += ALPHANUMERIC_CHARS[randomIndex];
  }
  return code;
}

/**
 * Creates a handoff record for an approved application.
 * Note: NEVER passes or persists Telegram invite URLs.
 */
export async function createHandoffRecord(
  applicationId: string,
  adminContactShown: string
) {
  if (!adminContactShown || adminContactShown.trim().length === 0) {
    throw new HandoffError(
      "INVALID_INPUT",
      "Admin contact information must be provided."
    );
  }

  // Verify application exists
  const existingApp = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });

  if (!existingApp) {
    throw new HandoffError(
      "NOT_FOUND",
      `Application with ID '${applicationId}' not found.`
    );
  }

  // Check if handoff record already exists for this application
  const existingHandoff = await db.query.handoffRecords.findFirst({
    where: eq(handoffRecords.applicationId, applicationId),
  });

  if (existingHandoff) {
    throw new HandoffError(
      "ALREADY_EXISTS",
      `Handoff record already exists for application '${applicationId}'.`
    );
  }

  const code = generateHandoffCode(6);

  const [inserted] = await db
    .insert(handoffRecords)
    .values({
      applicationId,
      code,
      adminContactShown,
      issuedAt: new Date(),
      usedAt: null,
    })
    .returning();

  return inserted;
}

/**
 * Marks a handoff record as used when member completes handoff flow.
 */
export async function markHandoffUsed(handoffId: string) {
  const existing = await db.query.handoffRecords.findFirst({
    where: eq(handoffRecords.id, handoffId),
  });

  if (!existing) {
    throw new HandoffError(
      "NOT_FOUND",
      `Handoff record with ID '${handoffId}' not found.`
    );
  }

  const [updated] = await db
    .update(handoffRecords)
    .set({
      usedAt: new Date(),
    })
    .where(eq(handoffRecords.id, handoffId))
    .returning();

  return updated;
}
