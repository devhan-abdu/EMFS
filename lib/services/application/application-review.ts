import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  applications,
  batchMemberships,
  handoffRecords,
  membershipAuditLogs,
} from "@/db/schema";

export type ApplicationReviewErrorCode =
  | "APPLICATION_NOT_FOUND"
  | "PENDING_MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_UPDATE_FAILED"
  | "DATABASE_TRANSACTION_ERROR";

export class ApplicationReviewError extends Error {
  code: ApplicationReviewErrorCode;
  constructor(code: ApplicationReviewErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ApplicationReviewError";
  }
}

export type ApplicationReviewDecision = "approved" | "rejected";

export type ReviewApplicationResult = {
  applicationId: string;
  membershipId: string;
  status: ApplicationReviewDecision;
  handoffCode?: string;
};

/**
 * Generates a URL-safe handoff code for the Telegram bot `start` payload.
 */
function generateHandoffCode(): string {
  return randomBytes(18).toString("base64url");
}

//  * Approve or reject a pending ("applied") batch-membership application.

export async function reviewApplication(
  applicationId: string,
  decision: ApplicationReviewDecision,
  actorId: string,
): Promise<ReviewApplicationResult> {
  return db.transaction(async (tx) => {
    const application = await tx.query.applications.findFirst({
      where: eq(applications.id, applicationId),
    });

    if (!application) {
      throw new ApplicationReviewError(
        "APPLICATION_NOT_FOUND",
        "Application not found.",
      );
    }

    const membership = await tx.query.batchMemberships.findFirst({
      where: and(
        eq(batchMemberships.profileId, application.profileId),
        eq(batchMemberships.batchId, application.batchId),
        eq(batchMemberships.status, "applied"),
      ),
    });

    if (!membership) {
      throw new ApplicationReviewError(
        "PENDING_MEMBERSHIP_NOT_FOUND",
        "No pending application membership found for this applicant in this batch.",
      );
    }

    const [updatedMembership] = await tx
      .update(batchMemberships)
      .set({
        status: decision,
        endDate: decision === "rejected" ? new Date() : null,
      })
      .where(eq(batchMemberships.id, membership.id))
      .returning();

    if (!updatedMembership) {
      throw new ApplicationReviewError(
        "MEMBERSHIP_UPDATE_FAILED",
        "Failed to update membership status.",
      );
    }

    await tx.insert(membershipAuditLogs).values({
      memberId: application.profileId,
      fromState: "applied",
      toState: decision,
      fromBatchId: application.batchId,
      toBatchId: decision === "approved" ? application.batchId : null,
      actorId,
      reason:
        decision === "approved" ?
          "Application approved by admin review."
        : "Application rejected by admin review.",
    });

    let handoffCode: string | undefined;

    if (decision === "approved") {
      // Guard against re-running review on an application that already has
      // a handoff record (e.g. accidental double submit).
      const existingHandoff = await tx.query.handoffRecords.findFirst({
        where: eq(handoffRecords.applicationId, application.id),
      });

      if (existingHandoff) {
        handoffCode = existingHandoff.code;
      } else {
        handoffCode = generateHandoffCode();
        await tx.insert(handoffRecords).values({
          applicationId: application.id,
          code: handoffCode,
        });
      }
    }

    return {
      applicationId: application.id,
      membershipId: updatedMembership.id,
      status: decision,
      handoffCode,
    };
  });
}
