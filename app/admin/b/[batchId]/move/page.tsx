import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-layout';
import { PendingMoveRequestsPanel } from '@/components/admin/pace-groups/pending-move-requests-panel';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { getPendingMoveRequests } from '@/lib/services/pace-groups/placement';

export default async function BatchMoveRequestsPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  await requireBatchAccess(batchId);

  const batch = await getBatchDetail(batchId);
  if (!batch) notFound();

  const requests = await getPendingMoveRequests(batchId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Move requests"
        description={`${batch.name} · review and approve pace-group move requests`}
      />
      <PendingMoveRequestsPanel batchId={batchId} initialRequests={requests} />
    </div>
  );
}
