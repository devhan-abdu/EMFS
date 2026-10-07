import { notFound } from 'next/navigation';

import { BatchSettingsForm } from '@/components/admin/batch-settings-form';
import { PageHeader } from '@/components/shared/page-layout';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';

export default async function BatchSettingsPage({
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
        title="Settings & offsets"
        description={`${batch.name} · cadence and break configuration`}
      />

      <BatchSettingsForm
        batchId={batchId}
        batchName={batch.name}
        readingDaysPerWeek={batch.readingDaysPerWeek}
      />
    </div>
  );
}
