import { eq } from 'drizzle-orm';
import { batches, paceGroups, telegramChats } from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import { toApiChatId, type TelegramApiPort } from './api-port';
import { normalizeName } from './topic-names';
import { syncNewBatchTopics } from './topic-sync';

/** Batch renamed in EMFS -> update the Telegram group title. */
export async function pushBatchTitle(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
): Promise<void> {
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.batchId, batchId),
  });

  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, batchId),
    columns: { name: true },
  });

  if (!chat || !batch || chat.status !== 'active') return;

  if (chat.title && normalizeName(chat.title) === normalizeName(batch.name)) {
    return;
  }

  try {
    await api.setChatTitle(toApiChatId(chat.chatId), batch.name);
  } catch (error) {
    if (!/CHAT_NOT_MODIFIED/i.test(String(error))) throw error;
  }

  await executor
    .update(telegramChats)
    .set({
      title: batch.name,
      updatedAt: new Date(),
    })
    .where(eq(telegramChats.id, chat.id));
}

/** New batch connected -> synchronize all Telegram topics. */
export async function pushBatchTopics(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
): Promise<string[]> {
  return syncNewBatchTopics(executor, api, batchId);
}

/** Pace group created, renamed, or updated -> synchronize its Telegram topic. */
export async function pushPaceGroupName(
  executor: DbOrTx,
  api: TelegramApiPort,
  paceGroupId: string,
): Promise<void> {
  const group = await executor.query.paceGroups.findFirst({
    where: eq(paceGroups.id, paceGroupId),
    columns: {
      batchId: true,
      archived: true,
    },
  });

  if (!group || group.archived) return;

  await syncNewBatchTopics(executor, api, group.batchId, paceGroupId);
}
