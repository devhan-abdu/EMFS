import { eq, and, inArray, count } from "drizzle-orm";
import { db } from "@/db";
import { applications, batches, batchMemberships, membershipAuditLogs } from "@/db/schema";
import type { CreateApplicationInput } from "@/lib/validations/application";
import {
  createBatchMembership,
  NON_TERMINAL_STATUSES,
} from "@/lib/services/membership";
import { createHandoffRecord } from "@/lib/services/handoff";
import { addToWaitlist } from "./waitlist";

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
// lib/services/application.ts (revised createApplication)
export async function createApplication(
  userId: string,
  authEmail: string,
  input: CreateApplicationInput
) {
  if (input.email.trim().toLowerCase() !== authEmail.trim().toLowerCase()) {
    throw new ApplicationError("EMAIL_MISMATCH", "Submitted email does not match authenticated user email.");
  }

  return await db.transaction(async (tx) => {
    
    const [batch] = await tx
      .select()
      .from(batches)
      .where(eq(batches.id, input.batchId))
      .for("update");

    if (!batch) {
      throw new ApplicationError("BATCH_NOT_FOUND", `Batch '${input.batchId}' not found.`);
    }

    const existingMembership = await tx.query.batchMemberships.findFirst({
      where: and(
        eq(batchMemberships.profileId, userId),
        eq(batchMemberships.batchId, input.batchId),
        inArray(batchMemberships.status, NON_TERMINAL_STATUSES),
      ),
    });
    if (existingMembership) {
      throw new ApplicationError("ALREADY_APPLIED", "You already have an application for this batch.");
    }

    const [{ activeCount }] = await tx
      .select({ activeCount: count() })
      .from(batchMemberships)
      .where(and(
        eq(batchMemberships.batchId, input.batchId),
        inArray(batchMemberships.status, ["approved", "active"]),
      ));

    const capacityRemains = Number(activeCount) < batch.maxMembers;

    const [application] = await tx
      .insert(applications)
      .values({ userId, ...input })
      .returning();

    if (batch.registrationOpen && batch.autoApprove && capacityRemains) {
      await createBatchMembership(userId, input.batchId, "approved", tx);
      await tx.insert(membershipAuditLogs).values({
        memberId: userId,
        fromState: "applied",
        toState: "approved",
        fromBatchId: input.batchId,
        toBatchId: input.batchId,
        actorId: "system",
        reason: "Auto-approved: capacity available at submission time",
        timestamp: new Date(),
      });
      await createHandoffRecord({ applicationId: application.id }, tx);
    } else if (batch.registrationOpen && capacityRemains) {
      await createBatchMembership(userId, input.batchId, "applied", tx);
    } else {
      await addToWaitlist(userId, input.batchId, tx);
    }

    return application;
  });
}
