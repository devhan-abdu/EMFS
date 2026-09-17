import { getEligibleBatchAdmins } from '@/lib/services/batches/batch';
import { CreateBatchForm } from '@/components/admin/create-batch-form';
import { PageHeader } from '@/components/shared/page-layout';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';

type Props = {
  params: Promise<{ batchId: string }>;
};

export default async function EditBatchPage({ params }: Props) {
  const { batchId } = await params;

  const [admins, existingBatch] = await Promise.all([
    getEligibleBatchAdmins(),
    getBatchDetail(batchId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Modify cohort" title="Edit batch settings" />
      <CreateBatchForm admins={admins} initialData={existingBatch} />
    </div>
  );
}
