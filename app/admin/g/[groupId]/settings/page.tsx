import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';

import { PageHeader } from '@/components/shared/page-layout';
import { SettingsAndOffsetsView } from '@/components/admin/settings/settings-and-offsets-view';
import { db } from '@/db';
import { batches, paceAdminAssignments, paceGroups } from '@/db/schema';
import {
  AuthzError,
  getAuthorizedBatchIds,
  requirePaceGroupAccess,
} from '@/lib/auth/authorize';
import { listBatchBreaks } from '@/lib/services/batches/breaks';
import { listPaceGroupOverridesForBatch } from '@/lib/services/batches/batch-schedule-overrides';

export const metadata: Metadata = {
  title: 'Settings & offsets — Pace-group workspace',
};

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function PaceGroupSettingsPage({ params }: Props) {
  const { groupId } = await params;
  let currentUser;
  try {
    currentUser = await requirePaceGroupAccess(groupId);
  } catch (error) {
    if (error instanceof AuthzError) redirect('/admin');
    throw error;
  }

  // Load the current pace group & parent batch
  const [group] = await db
    .select({
      id: paceGroups.id,
      name: paceGroups.name,
      batchId: batches.id,
      batchName: batches.name,
      readingDaysPerWeek: batches.readingDaysPerWeek,
      archived: paceGroups.archived,
    })
    .from(paceGroups)
    .innerJoin(batches, eq(batches.id, paceGroups.batchId))
    .where(eq(paceGroups.id, groupId))
    .limit(1);

  if (!group) notFound();

  // Find all pace groups this admin is assigned to in this batch
  const authorizedBatchIds = await getAuthorizedBatchIds(currentUser);
  const isSuperOrBatchAdmin =
    currentUser.profile.isSuperAdmin ||
    authorizedBatchIds === 'all' ||
    authorizedBatchIds.includes(group.batchId);

  let assignedGroups: { id: string; name: string }[] = [];
  if (isSuperOrBatchAdmin) {
    const allGroups = await db
      .select({ id: paceGroups.id, name: paceGroups.name })
      .from(paceGroups)
      .where(eq(paceGroups.batchId, group.batchId));
    assignedGroups = allGroups;
  } else {
    // Pace admin: only pace groups they are explicitly assigned to in this batch
    const assignments = await db
      .select({
        paceGroupId: paceAdminAssignments.paceGroupId,
        name: paceGroups.name,
        batchId: paceGroups.batchId,
      })
      .from(paceAdminAssignments)
      .innerJoin(
        paceGroups,
        eq(paceGroups.id, paceAdminAssignments.paceGroupId),
      )
      .where(eq(paceAdminAssignments.profileId, currentUser.profile.id));

    const batchSpecific = assignments.filter(
      (a) => a.batchId === group.batchId,
    );
    const uniqueMap = new Map<string, string>();
    for (const a of batchSpecific) {
      uniqueMap.set(a.paceGroupId, a.name);
    }
    uniqueMap.set(group.id, group.name);
    assignedGroups = Array.from(uniqueMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }

  const [breaks, overrides] = await Promise.all([
    listBatchBreaks(group.batchId, group.id),
    listPaceGroupOverridesForBatch(group.batchId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & offsets"
        description={`${group.batchName} · ${group.name} cadence and break configuration`}
      />

      <SettingsAndOffsetsView
        batch={{
          id: group.batchId,
          name: group.batchName,
          readingDaysPerWeek: group.readingDaysPerWeek,
        }}
        paceGroups={assignedGroups}
        initialBreaks={breaks}
        initialOverrides={overrides}
        role="pace_admin"
        initialScopeId={group.id}
        assignedGroupIds={assignedGroups.map((g) => g.id)}
      />
    </div>
  );
}
