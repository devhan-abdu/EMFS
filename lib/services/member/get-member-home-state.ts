import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  batchMemberships,
  batches,
  handoffRecords,
  paceGroupMemberships,
  waitlist,
} from "@/db/schema";
import { buildTelegramStartLink } from "@/lib/services/bot";

export type MemberHomeState =
  | { kind: "no_batch" }
  | { kind: "waitlisted"; batchName: string; queuePosition: number }
  | { kind: "applied"; batchName: string }
  | { kind: "rejected"; batchName: string }
  | {
      kind: "approved_pending_handoff";
      batchName: string;
      telegramStartLink: string | null;
    }
  | { kind: "active_awaiting_placement"; batchName: string }
  | { kind: "active_placed"; batchName: string };

export async function getMemberHomeState(
  profileId: string,
): Promise<MemberHomeState> {
  const membership = await db.query.batchMemberships.findFirst({
    where: eq(batchMemberships.profileId, profileId),
    orderBy: (fields, { desc }) => desc(fields.createdAt),
  });

  if (!membership) {
    return { kind: "no_batch" };
  }

  const batch = await db.query.batches.findFirst({
    where: eq(batches.id, membership.batchId),
  });
  const batchName = batch?.name ?? "your batch";

  if (membership.status === "waitlisted") {
    const entry = await db.query.waitlist.findFirst({
      where: and(
        eq(waitlist.userId, profileId),
        eq(waitlist.batchId, membership.batchId),
      ),
    });
    return {
      kind: "waitlisted",
      batchName,
      queuePosition: entry?.queuePosition ?? 0,
    };
  }

  if (membership.status === "applied") {
    return { kind: "applied", batchName };
  }

  if (membership.status === "rejected") {
    return { kind: "rejected", batchName };
  }

  if (membership.status === "approved") {
    const application = await db.query.applications.findFirst({
      where: and(
        eq(applications.profileId, profileId),
        eq(applications.batchId, membership.batchId),
      ),
      orderBy: (fields, { desc }) => desc(fields.createdAt),
    });

    const handoff =
      application ?
        await db.query.handoffRecords.findFirst({
          where: eq(handoffRecords.applicationId, application.id),
        })
      : null;

    return {
      kind: "approved_pending_handoff",
      batchName,
      telegramStartLink:
        handoff && !handoff.usedAt ?
          buildTelegramStartLink(handoff.code)
        : null,
    };
  }

  // active | grace — check real pace-group placement via existing schema
  const placement = await db.query.paceGroupMemberships.findFirst({
    where: and(
      eq(paceGroupMemberships.profileId, profileId),
      eq(paceGroupMemberships.status, "active"),
    ),
  });

  return placement ?
      { kind: "active_placed", batchName }
    : { kind: "active_awaiting_placement", batchName };
}
