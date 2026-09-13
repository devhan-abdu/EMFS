import { eq, and, inArray, count } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  batches,
  batchMemberships,
  membershipAuditLogs,
  profiles,
} from "@/db/schema";
import type { CreateApplicationInput } from "@/lib/validations/application";
import {
  createBatchMembership,
  NON_TERMINAL_STATUSES,
} from "@/lib/services/membership";
import { createHandoffRecord } from "@/lib/services/application/handoff";
import { addToWaitlist } from "./waitlist";

export type ApplicationErrorCode =
  | "EMAIL_MISMATCH"
  | "BATCH_NOT_FOUND"
  | "ALREADY_APPLIED"
  | "INVALID_INPUT"
  | "DATABASE_ERROR";

export class ApplicationError extends Error {
  code: ApplicationErrorCode;
  constructor(code: ApplicationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ApplicationError";
  }
}

export type ApplicationOutcome = "approved" | "applied" | "waitlisted";

export type CreateApplicationResult = {
  application: typeof applications.$inferSelect;
  outcome: ApplicationOutcome;
};

export async function createApplication(
  profileId: string,
  authEmail: string,
  input: CreateApplicationInput,
): Promise<CreateApplicationResult> {
  if (input.email.trim().toLowerCase() !== authEmail.trim().toLowerCase()) {
    throw new ApplicationError(
      "EMAIL_MISMATCH",
      "Submitted email does not match authenticated user email.",
    );
  }

  try {
    return await db.transaction(async (tx) => {
      const [batch] = await tx
        .select()
        .from(batches)
        .where(eq(batches.id, input.batchId))
        .for("update");

      if (!batch) {
        throw new ApplicationError(
          "BATCH_NOT_FOUND",
          `Batch '${input.batchId}' not found.`,
        );
      }
      const existingMembership = await tx.query.batchMemberships.findFirst({
        where: and(
          eq(batchMemberships.profileId, profileId),
          inArray(batchMemberships.status, NON_TERMINAL_STATUSES),
        ),
      });

      if (existingMembership) {
        throw new ApplicationError(
          "ALREADY_APPLIED",
          "You already have an active application or membership for a batch.",
        );
      }

      const [{ activeCount }] = await tx
        .select({
          activeCount: count(),
        })
        .from(batchMemberships)
        .where(
          and(
            eq(batchMemberships.batchId, input.batchId),
            inArray(batchMemberships.status, ["approved", "active"]),
          ),
        );

      const capacityRemains = Number(activeCount) < batch.maxMembers;

      await tx
        .update(profiles)
        .set({
          firstName: input.firstName,
          fatherName: input.fatherName,
          grandfatherName: input.grandfatherName ?? null,
          telegramUsername: input.telegramUsername,
          phone: input.phoneNumber,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, profileId));


      const [application] = await tx
        .insert(applications)
        .values({
          profileId,
          batchId: input.batchId,
          firstName: input.firstName,
          fatherName: input.fatherName,
          grandfatherName: input.grandfatherName ?? null,
          email: input.email,
          telegramUsername: input.telegramUsername,
          phoneNumber: input.phoneNumber,
          paceGroup: input.paceGroup,
        })
        .returning();

      let outcome: ApplicationOutcome;

      if (batch.registrationOpen && batch.autoApprove && capacityRemains) {
        await createBatchMembership(profileId, input.batchId, "approved", tx);

        await tx.insert(membershipAuditLogs).values({
          memberId: profileId,
          fromState: "applied",
          toState: "approved",
          fromBatchId: input.batchId,
          toBatchId: input.batchId,
          actorId: null,
          reason: "Auto-approved: capacity available at submission time",
          timestamp: new Date(),
        });

        await createHandoffRecord(
          {
            applicationId: application.id,
          },
          tx,
        );

        outcome = "approved";
      } else if (batch.registrationOpen && capacityRemains) {
        await createBatchMembership(profileId, input.batchId, "applied", tx);

        outcome = "applied";
      } else {
        await addToWaitlist(profileId, input.batchId, tx);

        outcome = "waitlisted";
      }

      return {
        application,
        outcome,
      };
    });
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }

    console.error("Database error during application creation:", error);

    throw new ApplicationError(
      "DATABASE_ERROR",
      "Unable to complete your application. Please try again.",
    );
  }
}
