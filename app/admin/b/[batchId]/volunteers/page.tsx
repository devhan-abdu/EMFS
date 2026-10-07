import { notFound } from 'next/navigation';

import { VolunteerRequestsPanel } from '@/components/admin/pace-groups/volunteer-requests-panel';
import { PageHeader } from '@/components/shared/page-layout';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';

export default async function BatchVolunteerRequestsPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  await requireBatchAccess(batchId);

  const batch = await getBatchDetail(batchId);
  if (!batch) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volunteer requests"
        description={`${batch.name} · approve or reject pace-admin volunteers`}
      />
      <VolunteerRequestsPanel batchId={batchId} batchName={batch.name} />
    </div>
  );
}
