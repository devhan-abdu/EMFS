import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-layout';
import { MoveHistoryPanel } from '@/components/admin/pace-groups/move-history-panel';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { getBatchMoveHistory } from '@/lib/services/pace-groups/placement';

export default async function BatchMoveHistoryPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  await requireBatchAccess(batchId);

  const batch = await getBatchDetail(batchId);
  if (!batch) notFound();

  const history = await getBatchMoveHistory({ batchId, page: 1, limit: 20 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Move history"
        description={`${batch.name} · audit trail for placement changes`}
      />
      <MoveHistoryPanel _batchId={batchId} initialHistory={history} />
    </div>
  );
}
