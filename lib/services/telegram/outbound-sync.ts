import { eq } from 'drizzle-orm';
import {
  batches,
  paceGroups,
  telegramChats,
  telegramChatTopics,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import { toApiChatId, type TelegramApiPort } from './api-port';
import { recordObservedTopic } from './observed-topics';
import { isNotModified, syncTopics } from './topic-sync';
import { normalizeName, paceTopicName } from './topic-names';

/** Batch renamed in the system -> rename the Telegram group. */
export async function pushBatchTitle(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
) {
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.batchId, batchId),
  });
  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, batchId),
    columns: { name: true },
  });
  if (!chat || !batch || chat.status !== 'active') return;
  if (chat.title && normalizeName(chat.title) === normalizeName(batch.name))
    return;

  try {
    await api.setChatTitle(toApiChatId(chat.chatId), batch.name);
  } catch (e) {
    if (!/CHAT_NOT_MODIFIED/i.test(String(e))) throw e;
  }
  await executor
    .update(telegramChats)
    .set({ title: batch.name, updatedAt: new Date() })
    .where(eq(telegramChats.id, chat.id));
}

/** Pace group renamed or its pace changed -> rename its topic. */
export async function pushPaceGroupName(
  executor: DbOrTx,
  api: TelegramApiPort,
  paceGroupId: string,
) {
  const [row] = await executor
    .select({
      group: paceGroups,
      topic: telegramChatTopics,
      chat: telegramChats,
    })
    .from(telegramChatTopics)
    .innerJoin(paceGroups, eq(paceGroups.id, telegramChatTopics.paceGroupId))
    .innerJoin(
      telegramChats,
      eq(telegramChats.id, telegramChatTopics.telegramChatId),
    )
    .where(eq(telegramChatTopics.paceGroupId, paceGroupId));
  if (!row || row.chat.status !== 'active' || !row.chat.canManageTopics) return;

  const expected = paceTopicName(row.group);
  try {
    await api.editForumTopic(
      toApiChatId(row.chat.chatId),
      row.topic.messageThreadId,
      expected,
    );
  } catch (e) {
    if (!isNotModified(e)) throw e;
  }
  await executor
    .update(telegramChatTopics)
    .set({ name: expected })
    .where(eq(telegramChatTopics.id, row.topic.id));
  await recordObservedTopic(executor, {
    chatId: row.chat.chatId,
    messageThreadId: row.topic.messageThreadId,
    name: expected,
    source: 'edited',
  });
}

/** New pace group created -> create/match only its own topic. */
export async function ensureTopicForPaceGroup(
  executor: DbOrTx,
  api: TelegramApiPort,
  paceGroupId: string,
) {
  const group = await executor.query.paceGroups.findFirst({
    where: eq(paceGroups.id, paceGroupId),
  });
  if (!group || group.archived) return;
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.batchId, group.batchId),
  });
  if (
    !chat ||
    chat.status !== 'active' ||
    !chat.isForum ||
    !chat.canManageTopics
  )
    return;
  await syncTopics(executor, api, group.batchId, paceGroupId);
}
