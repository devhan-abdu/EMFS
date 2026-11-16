import { and, eq } from 'drizzle-orm';
import {
  batches,
  paceGroups,
  telegramChats,
  telegramChatTopics,
  type TelegramChat,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import { toApiChatId, type TelegramApiPort } from './api-port';
import { TelegramConnectionError, describeTelegramError } from './errors';
import { paceTopicName } from './topic-names';
import { syncChatInfo } from './connection';

export const ANNOUNCEMENT_TOPIC_NAME = '📢 Announcements';

export const isNotModified = (error: unknown) =>
  /TOPIC_NOT_MODIFIED/i.test(describeTelegramError(error));

async function loadUsableChat(
  executor: DbOrTx,
  batchId: string,
): Promise<TelegramChat> {
  const [chat] = await executor
    .select()
    .from(telegramChats)
    .where(eq(telegramChats.batchId, batchId))
    .limit(1);

  if (!chat) {
    throw new TelegramConnectionError(
      'NOT_CONNECTED',
      'This batch has no Telegram group.',
    );
  }

  if (chat.status !== 'active') {
    throw new TelegramConnectionError(
      'TELEGRAM_API_ERROR',
      'The bot is no longer in the group.',
    );
  }

  if (!chat.isForum) {
    throw new TelegramConnectionError(
      'NOT_A_FORUM',
      'Topics are off in the Telegram group.',
    );
  }

  if (!chat.canManageTopics) {
    throw new TelegramConnectionError(
      'TELEGRAM_API_ERROR',
      'Give the bot the "Manage topics" admin right.',
    );
  }

  return chat;
}

/** Rename an existing Telegram topic. */
async function renameTopic(
  api: TelegramApiPort,
  chat: TelegramChat,
  messageThreadId: number,
  name: string,
): Promise<void> {
  try {
    await api.editForumTopic(toApiChatId(chat.chatId), messageThreadId, name);
  } catch (error) {
    if (!isNotModified(error)) throw error;
  }
}

/** Create a Telegram topic and save its EMFS mapping. */
async function createAndMapTopic(
  executor: DbOrTx,
  api: TelegramApiPort,
  chat: TelegramChat,
  input: {
    name: string;
    kind: 'pace_group' | 'announcement';
    paceGroupId?: string;
  },
): Promise<void> {
  const created = await api.createForumTopic(
    toApiChatId(chat.chatId),
    input.name,
  );

  const inserted = await executor
    .insert(telegramChatTopics)
    .values({
      telegramChatId: chat.id,
      messageThreadId: created.messageThreadId,
      kind: input.kind,
      paceGroupId: input.paceGroupId ?? null,
      name: input.name,
    })
    .onConflictDoNothing()
    .returning({ id: telegramChatTopics.id });

  if (inserted.length === 0) {
    throw new Error(
      `Telegram topic "${input.name}" was created, but its EMFS mapping could not be saved.`,
    );
  }
}

/** Update the Telegram topic and its stored mapping name. */
async function updateMappedTopic(
  executor: DbOrTx,
  api: TelegramApiPort,
  chat: TelegramChat,
  input: {
    topicId: string;
    messageThreadId: number;
    expectedName: string;
  },
): Promise<void> {
  await renameTopic(api, chat, input.messageThreadId, input.expectedName);

  await executor
    .update(telegramChatTopics)
    .set({ name: input.expectedName })
    .where(eq(telegramChatTopics.id, input.topicId));
}

/**
 * Synchronizes topics for a managed batch.
 *
 * EMFS is the source of truth:
 * - Missing pace-group topic -> create it.
 * - Existing mapped topic -> update its name.
 * - Missing announcement topic -> create it.
 *
 * Does not discover or match existing Telegram topics by name.
 */
export async function syncNewBatchTopics(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
  onlyPaceGroupId?: string,
): Promise<string[]> {
  const chat = await loadUsableChat(executor, batchId);
  const report: string[] = [];

  const groups = await executor
    .select()
    .from(paceGroups)
    .where(
      and(eq(paceGroups.batchId, batchId), eq(paceGroups.archived, false)),
    );

  for (const group of groups) {
    if (onlyPaceGroupId && group.id !== onlyPaceGroupId) continue;

    const expectedName = paceTopicName(group);

    try {
      const [mapping] = await executor
        .select()
        .from(telegramChatTopics)
        .where(
          and(
            eq(telegramChatTopics.telegramChatId, chat.id),
            eq(telegramChatTopics.paceGroupId, group.id),
          ),
        )
        .limit(1);

      if (!mapping) {
        await createAndMapTopic(executor, api, chat, {
          name: expectedName,
          kind: 'pace_group',
          paceGroupId: group.id,
        });

        report.push(`${expectedName} (created)`);
        continue;
      }

      await updateMappedTopic(executor, api, chat, {
        topicId: mapping.id,
        messageThreadId: mapping.messageThreadId,
        expectedName,
      });

      report.push(`${expectedName} (synchronized)`);
    } catch (error) {
      report.push(`${expectedName}: ${describeTelegramError(error)}`);
    }
  }

  // Announcements are handled only during a full batch synchronization.
  if (!onlyPaceGroupId) {
    try {
      const [announcement] = await executor
        .select()
        .from(telegramChatTopics)
        .where(
          and(
            eq(telegramChatTopics.telegramChatId, chat.id),
            eq(telegramChatTopics.kind, 'announcement'),
          ),
        )
        .limit(1);

      if (!announcement) {
        await createAndMapTopic(executor, api, chat, {
          name: ANNOUNCEMENT_TOPIC_NAME,
          kind: 'announcement',
        });

        report.push('Announcements (created)');
      } else {
        await renameTopic(
          api,
          chat,
          announcement.messageThreadId,
          ANNOUNCEMENT_TOPIC_NAME,
        );

        await executor
          .update(telegramChatTopics)
          .set({ name: ANNOUNCEMENT_TOPIC_NAME })
          .where(eq(telegramChatTopics.id, announcement.id));

        report.push('Announcements (synchronized)');
      }
    } catch (error) {
      report.push(`Announcements: ${describeTelegramError(error)}`);
    }
  }

  return report.length > 0 ? report : ['Everything already matches.'];
}

export async function restoreLinkedChat(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
): Promise<string[]> {
  await syncChatInfo(executor, api, batchId);

  const [batch] = await executor
    .select({ mode: batches.telegramTopicSyncMode })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);

  return batch?.mode === 'managed'
    ? syncNewBatchTopics(executor, api, batchId)
    : [];
}
