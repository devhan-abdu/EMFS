import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { handoffRecords, applications } from "@/db/schema";

export type HandoffErrorCode = "NOT_FOUND" | "ALREADY_EXISTS" | "INVALID_INPUT" | "ALREADY_USED" | "CODE_COLLISION";

export class HandoffError extends Error {
  code: HandoffErrorCode;
  constructor(code: HandoffErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "HandoffError";
  }
}

import { createHandoffSchema, type CreateHandoffInput } from "@/lib/validations/handoff";

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
export async function createHandoffRecord(input: CreateHandoffInput) {
  const parsed = createHandoffSchema.safeParse(input);
  if (!parsed.success) {
    throw new HandoffError("INVALID_INPUT", parsed.error.issues[0].message);
  }

  const { applicationId, adminContactShown } = parsed.data;

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

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
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
    } catch (error: unknown) {
      // Handle Postgres unique constraint violation on the handoff code
      // constraint names might be "unique_handoff_code_idx" or similar depending on the exact generated name
      const err = error as { code?: string; message?: string };
      if (err.code === "23505" && err.message?.includes("unique_handoff_code_idx")) {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          throw new HandoffError(
            "CODE_COLLISION",
            "Failed to generate a unique handoff code after multiple attempts."
          );
        }
        continue;
      }
      // Rethrow other errors
      throw error;
    }
  }

  throw new HandoffError("CODE_COLLISION", "Failed to generate a unique handoff code.");
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

  if (existing.usedAt !== null) {
    throw new HandoffError(
      "ALREADY_USED",
      `Handoff record with ID '${handoffId}' has already been used.`
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
