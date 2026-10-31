import { and, eq, ne } from 'drizzle-orm';
import {
  batches,
  paceGroups,
  telegramChats,
  telegramChatTopics,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import { toApiChatId, type TelegramApiPort } from './api-port';
import { isUniqueViolation } from './errors';
import { recordObservedTopic } from './observed-topics';
import { isNotModified } from './topic-sync';
import {
  normalizeName,
  paceTopicName,
  parsePaceTopicName,
} from './topic-names';

/** Group renamed in Telegram -> batch name follows. */
export async function applyTelegramTitleChange(
  executor: DbOrTx,
  input: { chatId: bigint; title: string },
) {
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.chatId, input.chatId),
  });
  if (!chat) return;
  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, chat.batchId),
    columns: { name: true },
  });
  if (batch && normalizeName(batch.name) !== normalizeName(input.title)) {
    await executor
      .update(batches)
      .set({ name: input.title.trim(), updatedAt: new Date() })
      .where(eq(batches.id, chat.batchId));
  }
  await executor
    .update(telegramChats)
    .set({ title: input.title, updatedAt: new Date() })
    .where(eq(telegramChats.id, chat.id));
}

export type TopicRenameResult =
  'accepted' | 'unchanged' | 'reverted' | 'ignored';

/**
 * Topic renamed in Telegram -> pace group follows ("Name · N pages").
 * Reverted in Telegram only when the new name is unreadable or would duplicate
 * another pace group's name (the one conflict we never allow).
 */
export async function applyTelegramTopicRename(
  executor: DbOrTx,
  api: TelegramApiPort,
  input: { chatId: bigint; messageThreadId: number; newName: string },
): Promise<TopicRenameResult> {
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.chatId, input.chatId),
  });
  if (!chat || chat.status !== 'active') return 'ignored';

  const topic = await executor.query.telegramChatTopics.findFirst({
    where: and(
      eq(telegramChatTopics.telegramChatId, chat.id),
      eq(telegramChatTopics.messageThreadId, input.messageThreadId),
    ),
  });
  if (!topic) return 'ignored'; // unmapped topics are free-form

  const apiChatId = toApiChatId(chat.chatId);
  const setTopicName = async (name: string) => {
    if (!chat.canManageTopics) return;
    try {
      await api.editForumTopic(apiChatId, input.messageThreadId, name);
    } catch (e) {
      if (!isNotModified(e)) throw e;
    }
    await recordObservedTopic(executor, {
      chatId: chat.chatId,
      messageThreadId: input.messageThreadId,
      name,
      source: 'edited',
    });
  };

  if (topic.kind === 'announcement') {
    await executor
      .update(telegramChatTopics)
      .set({ name: input.newName })
      .where(eq(telegramChatTopics.id, topic.id));
    return 'accepted';
  }
  if (!topic.paceGroupId) return 'ignored';

  const group = await executor.query.paceGroups.findFirst({
    where: eq(paceGroups.id, topic.paceGroupId),
  });
  if (!group) return 'ignored';

  const canonical = paceTopicName(group);
  if (normalizeName(input.newName) === normalizeName(canonical))
    return 'unchanged';

  const revert = async (): Promise<'reverted'> => {
    await setTopicName(canonical);
    return 'reverted';
  };

  const parsed = parsePaceTopicName(input.newName);
  if (!parsed || parsed.name.length > 100) return revert();

  const siblings = await executor
    .select({ name: paceGroups.name })
    .from(paceGroups)
    .where(
      and(
        eq(paceGroups.batchId, group.batchId),
        eq(paceGroups.archived, false),
        ne(paceGroups.id, group.id),
      ),
    );
  if (
    siblings.some((s) => normalizeName(s.name) === normalizeName(parsed.name))
  ) {
    return revert();
  }

  try {
    await executor
      .update(paceGroups)
      .set({ name: parsed.name, size: parsed.size, updatedAt: new Date() })
      .where(eq(paceGroups.id, group.id));
  } catch (e) {
    if (isUniqueViolation(e)) return revert();
    throw e;
  }

  const newCanonical = paceTopicName(parsed);
  await executor
    .update(telegramChatTopics)
    .set({ name: newCanonical })
    .where(eq(telegramChatTopics.id, topic.id));
  if (normalizeName(input.newName) !== normalizeName(newCanonical)) {
    await setTopicName(newCanonical); // tidy up "nur - 20" into "Nur · 20 pages"
  }
  return 'accepted';
}
