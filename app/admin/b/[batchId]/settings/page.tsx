import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-layout';
import { SettingsAndOffsetsView } from '@/components/admin/settings/settings-and-offsets-view';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { listPaceGroupsForBatch } from '@/lib/services/pace-groups/pace-group';
import { listBatchBreaks } from '@/lib/services/batches/breaks';
import { listPaceGroupOverridesForBatch } from '@/lib/services/batches/batch-schedule-overrides';

export default async function BatchSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams?: Promise<{ scope?: string }>;
}) {
  const { batchId } = await params;
  const currentUser = await requireBatchAccess(batchId);

  const [batch, groups, breaks, overrides] = await Promise.all([
    getBatchDetail(batchId),
    listPaceGroupsForBatch({ batchId, includeArchived: false }),
    listBatchBreaks(batchId),
    listPaceGroupOverridesForBatch(batchId),
  ]);

  if (!batch) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialScopeId = resolvedSearchParams?.scope ?? 'all';
  const role = currentUser.profile.isSuperAdmin ? 'super_admin' : 'batch_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & offsets"
        description={`${batch.name} · cadence and break configuration`}
      />

      <SettingsAndOffsetsView
        batch={{
          id: batch.id,
          name: batch.name,
          readingDaysPerWeek: batch.readingDaysPerWeek,
        }}
        paceGroups={groups.map((g) => ({ id: g.id, name: g.name }))}
        initialBreaks={breaks}
        initialOverrides={overrides}
        role={role}
        initialScopeId={initialScopeId}
      />
    </div>
  );
}
