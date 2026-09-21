import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import {
  applications,
  batches,
  batchMemberships,
  handoffRecords,
  profiles,
} from '@/db/schema';
import { buildTelegramStartLink } from '@/lib/services/bot';
import type { CurrentUser } from '@/lib/auth/session';
import { getAuthorizedBatchIds } from '@/lib/auth/authorize';

export type ApplicationHandoffStatus =
  'pending' | 'approved_pending_handoff' | 'active' | 'rejected';

export type AdminApplicationWithHandoff = {
  id: string;
  profileId: string;
  batchId: string;
  name: string;
  email: string;
  batch: string;
  appliedOn: string;
  status: ApplicationHandoffStatus;
  handoffIssuedAt: Date | null;
  handoffUsedAt: Date | null;
  telegramChatId: number | null;
  handoffBotLink: string | null;
  daysSinceApproved: number | null;
};

function deriveStatus(
  membershipStatus: string | null | undefined,
  handoffUsedAt: Date | null | undefined,
): ApplicationHandoffStatus {
  if (!membershipStatus || membershipStatus === 'applied') return 'pending';
  if (membershipStatus === 'rejected') return 'rejected';
  if (membershipStatus === 'approved') {
    return handoffUsedAt ? 'active' : 'approved_pending_handoff';
  }
  return 'active';
}

export async function getAdminApplicationsWithHandoff(
  batchId?: string,
  userContext?: CurrentUser,
): Promise<AdminApplicationWithHandoff[]> {
  const conditions: SQL[] = [];

  if (userContext) {
    if (
      userContext.profile.role === 'pace_admin' ||
      userContext.profile.role === 'member'
    ) {
      return [];
    }

    const authBatchIds = await getAuthorizedBatchIds(userContext);
    if (authBatchIds !== 'all') {
      if (authBatchIds.length === 0) return [];
      if (batchId) {
        if (!authBatchIds.includes(batchId)) {
          return []; // Prevents client-controlled scope bypass
        }
        conditions.push(eq(applications.batchId, batchId));
      } else {
        conditions.push(inArray(applications.batchId, authBatchIds));
      }
    } else if (batchId) {
      conditions.push(eq(applications.batchId, batchId));
    }
  } else if (batchId) {
    conditions.push(eq(applications.batchId, batchId));
  }

  const query = db
    .select({
      id: applications.id,
      profileId: applications.profileId,
      batchId: applications.batchId,
      email: applications.email,
      createdAt: applications.createdAt,
      batchName: batches.name,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      membershipStatus: batchMemberships.status,
      handoffCode: handoffRecords.code,
      handoffIssuedAt: handoffRecords.issuedAt,
      handoffUsedAt: handoffRecords.usedAt,
      telegramChatId: handoffRecords.telegramChatId,
    })
    .from(applications)
    .leftJoin(batches, eq(applications.batchId, batches.id))
    .leftJoin(profiles, eq(applications.profileId, profiles.id))
    .leftJoin(
      batchMemberships,
      eq(batchMemberships.profileId, applications.profileId),
    )
    .leftJoin(
      handoffRecords,
      eq(handoffRecords.applicationId, applications.id),
    );

  const rows = await (conditions.length > 0
    ? query.where(and(...conditions)).orderBy(desc(applications.createdAt))
    : query.orderBy(desc(applications.createdAt)));

  const now = Date.now();

  return rows.map((row) => {
    const status = deriveStatus(row.membershipStatus, row.handoffUsedAt);
    const daysSinceApproved = row.handoffIssuedAt
      ? Math.floor(
          (now - new Date(row.handoffIssuedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      id: row.id,
      profileId: row.profileId,
      batchId: row.batchId,
      name: row.firstName
        ? `${row.firstName} ${row.fatherName ?? ''}`.trim()
        : `${row.firstName} ${row.fatherName}`.trim(),
      email: row.email,
      batch: row.batchName ?? '—',
      appliedOn: new Date(row.createdAt).toLocaleDateString(),
      status,
      handoffIssuedAt: row.handoffIssuedAt ?? null,
      handoffUsedAt: row.handoffUsedAt ?? null,
      telegramChatId:
        row.telegramChatId === null || row.telegramChatId === undefined
          ? null
          : Number(row.telegramChatId),
      handoffBotLink:
        status === 'approved_pending_handoff' && row.handoffCode
          ? buildTelegramStartLink(row.handoffCode)
          : null,
      daysSinceApproved,
    };
  });
}
