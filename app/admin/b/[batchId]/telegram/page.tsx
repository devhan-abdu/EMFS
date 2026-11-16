import { notFound } from 'next/navigation';

import { TelegramConnectionCard } from '@/components/admin/telegram-connection-card';
import { PageHeader } from '@/components/shared/page-layout';
import { db } from '@/db';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { getConnection } from '@/lib/services/telegram/connection';

export default async function BatchTelegramPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  await requireBatchAccess(batchId);

  const [batch, connection] = await Promise.all([
    getBatchDetail(batchId),
    getConnection(db, batchId),
  ]);

  if (!batch) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram"
        description={`${batch.name} · connect the batch group and its pace group topics`}
      />
      <TelegramConnectionCard
        batchId={batchId}
        batchName={batch.name}
        topicSyncMode={batch.telegramTopicSyncMode}
        connection={connection}
      />
    </div>
  );
}
