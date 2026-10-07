import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-layout';
import { PaceGroupList } from '@/components/admin/pace-groups/pace-group-list';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { listPaceAdminAssignments } from '@/lib/services/admin/pace-admin-assignment';
import { listPaceGroupsForBatch } from '@/lib/services/pace-groups/pace-group';
import type { PaceGroupWithAdmins } from '@/components/admin/pace-groups/types';

export default async function BatchGroupsPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
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
        title="Pace groups"
        description={`${batch.name} · existing groups and admin assignments`}
      />
      <PaceGroupList batchId={batchId} initialGroups={groups} />
    </div>
  );
}
