import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { batchAdmins, batchMemberships, batches, profiles } from "@/db/schema";

export type BatchDetail = {
  id: string;
  name: string;
  maxMembers: number;
  paceGroupCount: number;
  registrationOpen: boolean;
  autoApprove: boolean;
  startDate: string | null;
  readingDaysPerWeek: number;
  enrolled: number;
  admins: { profileId: string; name: string }[];
};

export async function getBatchDetail(
  batchId: string,
): Promise<BatchDetail | null> {
  const batch = await db.query.batches.findFirst({
    where: eq(batches.id, batchId),
  });
  if (!batch) return null;

  const [{ enrolled }] = await db
    .select({
      enrolled: sql<number>`count(*) filter (where ${batchMemberships.status} in ('approved', 'active', 'grace'))`,
    })
    .from(batchMemberships)
    .where(eq(batchMemberships.batchId, batchId));

  const adminRows = await db
    .select({
      profileId: profiles.id,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
    })
    .from(batchAdmins)
    .innerJoin(profiles, eq(profiles.id, batchAdmins.profileId))
    .where(eq(batchAdmins.batchId, batchId));

  return {
    id: batch.id,
    name: batch.name,
    maxMembers: batch.maxMembers,
    paceGroupCount: batch.paceGroupCount,
    registrationOpen: batch.registrationOpen,
    autoApprove: batch.autoApprove,
    startDate: batch.startDate,
    readingDaysPerWeek: batch.readingDaysPerWeek,
    enrolled: Number(enrolled ?? 0),
    admins: adminRows.map((a) => ({
      profileId: a.profileId,
      name: `${a.firstName} ${a.fatherName ?? ""}`.trim(),
    })),
  };
}
