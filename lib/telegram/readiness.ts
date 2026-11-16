import { and, count, eq } from 'drizzle-orm';
import { batches, paceGroups } from '@/db/schema';
import { DbOrTx } from '../services/user-search';
import { batchIdSchema } from '../validations/telegram';

export async function getConnectBlocker(executor: DbOrTx, batchId: string) {
  batchIdSchema.parse(batchId);

  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, batchId),
    columns: { telegramTopicSyncMode: true },
  });
  if (!batch) return 'Batch not found.';

  // Manual mode registers existing topics later, so it needs no pace group yet.
  if (batch.telegramTopicSyncMode === 'managed') {
    const [{ groups }] = await executor
      .select({ groups: count() })
      .from(paceGroups)
      .where(
        and(eq(paceGroups.batchId, batchId), eq(paceGroups.archived, false)),
      );

    if (groups === 0)
      return 'Create at least one pace group before connecting Telegram.';
  }

  return null;
}
