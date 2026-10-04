import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-layout';
import { MemberPlacementPanel } from '@/components/admin/pace-groups/member-placement-panel';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { listPaceGroupsForBatch } from '@/lib/services/pace-groups/pace-group';
import { listPaceAdminAssignments } from '@/lib/services/pace-groups/pace-admin-assignment';
import type { PaceGroupWithAdmins } from '@/components/admin/pace-groups/types';

export default async function BatchMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{
    q?: string;
    search?: string;
    status?: string;
    preference?: string;
    pref?: string;
  }>;
}) {
  const { batchId } = await params;
  const filters = await searchParams;
  await requireBatchAccess(batchId);

  const [batch, rawGroups] = await Promise.all([
    getBatchDetail(batchId),
    listPaceGroupsForBatch({ batchId, includeArchived: true }),
  ]);

  if (!batch) notFound();

  const groups: PaceGroupWithAdmins[] = await Promise.all(
    rawGroups.map(async (group) => ({
      ...group,
      admins: await listPaceAdminAssignments({ paceGroupId: group.id }),
    })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members & placements"
        description={`${batch.name} · member roster and placement decisions`}
      />
      <MemberPlacementPanel
        batchId={batchId}
        batchName={batch.name}
        paceGroups={groups}
        totalMemberCount={batch.enrolled}
        searchParams={filters}
      />
    </div>
  );
}
