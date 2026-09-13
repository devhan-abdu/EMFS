import { eq } from "drizzle-orm";
import { db } from "@/db";
import { batches, paceGroups } from "@/db/schema";
import { findActiveMembershipAnywhere } from "@/lib/services/membership";

export type BatchForApplication = {
  batch: {
    id: string;
    name: string;
    registrationOpen: boolean;
  } | null;
  hasSelectablePaceGroups: boolean;
  existingMembership: { status: string; batchId: string } | null;
};

export async function getBatchForApplication(
  batchId: string,
  profileId: string,
): Promise<BatchForApplication> {
  const [batch, groups, existingMembership] = await Promise.all([
    db.query.batches.findFirst({ where: eq(batches.id, batchId) }),
    db.query.paceGroups.findMany({ where: eq(paceGroups.batchId, batchId) }),
    findActiveMembershipAnywhere(profileId),
  ]);

  return {
    batch: batch ?? null,
    hasSelectablePaceGroups: groups.length > 0,
    existingMembership:
      existingMembership ?
        {
          status: existingMembership.status,
          batchId: existingMembership.batchId,
        }
      : null,
  };
}
