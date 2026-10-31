import { and, eq } from 'drizzle-orm';
import {
  paceGroups,
  telegramChats,
  telegramChatTopics,
  telegramObservedTopics,
  type TelegramChat,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import { toApiChatId, type TelegramApiPort } from './api-port';
import { TelegramConnectionError, describeTelegramError } from './errors';
import { recordObservedTopic } from './observed-topics';
import {
  normalizeName,
  paceTopicName,
  parsePaceTopicName,
} from './topic-names';
import { loadPaceTopicState } from './topic-state';

export const ANNOUNCEMENT_TOPIC_NAME = 'Announcements';

export const isNotModified = (e: unknown) =>
  /TOPIC_NOT_MODIFIED/i.test(describeTelegramError(e));

async function loadUsableChat(
  tx: DbOrTx,
  batchId: string,
): Promise<TelegramChat> {
  const [chat] = await tx
    .select()
    .from(telegramChats)
    .where(eq(telegramChats.batchId, batchId))
    .for('no key update');
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

async function createTopic(
  observedExecutor: DbOrTx,
  api: TelegramApiPort,
  chat: TelegramChat,
  name: string,
): Promise<number> {
  const created = await api.createForumTopic(toApiChatId(chat.chatId), name);
  // Separate connection: stays recorded even if the surrounding transaction later fails.
  await recordObservedTopic(observedExecutor, {
    chatId: chat.chatId,
    messageThreadId: created.messageThreadId,
    name,
    source: 'created',
  });
  return created.messageThreadId;
}

async function mapPace(
  tx: DbOrTx,
  chat: TelegramChat,
  paceGroupId: string,
  messageThreadId: number,
  name: string,
) {
  await tx
    .insert(telegramChatTopics)
    .values({
      telegramChatId: chat.id,
      messageThreadId,
      kind: 'pace_group',
      paceGroupId,
      name,
    })
    .onConflictDoNothing();
}


export async function syncTopics(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
  onlyPaceGroupId?: string,
): Promise<string[]> {
  return executor.transaction(async (tx) => {
    const chat = await loadUsableChat(tx, batchId);
    const apiChatId = toApiChatId(chat.chatId);
    const { evaluations, announcementThreadId } = await loadPaceTopicState(
      tx,
      chat,
    );
    const report: string[] = [];

    for (const e of evaluations) {
      if (onlyPaceGroupId && e.paceGroupId !== onlyPaceGroupId) continue;
      try {
        if (e.status === 'ready_to_match' && e.messageThreadId !== null) {
          await mapPace(
            tx,
            chat,
            e.paceGroupId,
            e.messageThreadId,
            e.expectedName,
          );
          report.push(` ${e.expectedName} (matched existing topic)`);
        } else if (e.status === 'missing') {
          const threadId = await createTopic(
            executor,
            api,
            chat,
            e.expectedName,
          );
          await mapPace(tx, chat, e.paceGroupId, threadId, e.expectedName);
          report.push(` ${e.expectedName} (created)`);
        } else if (e.status === 'name_mismatch' && e.messageThreadId !== null) {
          try {
            await api.editForumTopic(
              apiChatId,
              e.messageThreadId,
              e.expectedName,
            );
          } catch (err) {
            if (!isNotModified(err)) throw err;
          }
          await recordObservedTopic(executor, {
            chatId: chat.chatId,
            messageThreadId: e.messageThreadId,
            name: e.expectedName,
            source: 'edited',
          });
          report.push(` ${e.expectedName} (topic renamed)`);
        } else if (e.status !== 'mapped') {
          report.push(` ${e.groupName}: ${e.hint ?? 'needs attention'}`);
        }
      } catch (error) {
        report.push(` ${e.expectedName}: ${describeTelegramError(error)}`);
      }
    }

    if (!onlyPaceGroupId && announcementThreadId === null) {
      try {
        const mapped = await tx
          .select({ t: telegramChatTopics.messageThreadId })
          .from(telegramChatTopics)
          .where(eq(telegramChatTopics.telegramChatId, chat.id));
        const used = new Set(mapped.map((m) => m.t));
        const observed = await tx
          .select()
          .from(telegramObservedTopics)
          .where(eq(telegramObservedTopics.telegramChatId, chat.id));
        const existing = observed.find(
          (o) =>
            !used.has(o.messageThreadId) &&
            normalizeName(o.name) === normalizeName(ANNOUNCEMENT_TOPIC_NAME),
        );
        const threadId =
          existing?.messageThreadId ??
          (await createTopic(executor, api, chat, ANNOUNCEMENT_TOPIC_NAME));
        await tx
          .insert(telegramChatTopics)
          .values({
            telegramChatId: chat.id,
            messageThreadId: threadId,
            kind: 'announcement',
            name: ANNOUNCEMENT_TOPIC_NAME,
          })
          .onConflictDoNothing();
        report.push(` Announcements (${existing ? 'matched' : 'created'})`);
      } catch (error) {
        report.push(` Announcements: ${describeTelegramError(error)}`);
      }
    }

    return report.length > 0 ? report : ['Everything already matches.'];
  });
}

/**
 * Wrong pace between a topic and a pace group: the admin picks who wins.
 *  keep 'system'   -> rename the topic to the system's name
 *  keep 'telegram' -> change the pace group's pages/day to the topic's
 */
export async function resolveWrongPace(
  executor: DbOrTx,
  api: TelegramApiPort,
  input: { batchId: string; paceGroupId: string; keep: 'system' | 'telegram' },
): Promise<string> {
  return executor.transaction(async (tx) => {
    const chat = await loadUsableChat(tx, input.batchId);
    const { evaluations } = await loadPaceTopicState(tx, chat);
    const e = evaluations.find((x) => x.paceGroupId === input.paceGroupId);
    if (
      !e ||
      e.status !== 'wrong_pace' ||
      e.messageThreadId === null ||
      !e.observedName
    ) {
      throw new TelegramConnectionError(
        'NOTHING_TO_RESOLVE',
        'This pace group has no pace mismatch to resolve.',
      );
    }

    let size = Number(
      /(\d+)\s*(?:pages?|pgs?|p)?\s*$/i.exec(e.expectedName)?.[1],
    );
    if (input.keep === 'telegram') {
      const parsed = parsePaceTopicName(e.observedName);
      if (!parsed) {
        throw new TelegramConnectionError(
          'NOTHING_TO_RESOLVE',
          'Cannot read the topic pace.',
        );
      }
      size = parsed.size;
      await tx
        .update(paceGroups)
        .set({ size, updatedAt: new Date() })
        .where(eq(paceGroups.id, e.paceGroupId));
    }

    const canonical = paceTopicName({ name: e.groupName, size });
    if (normalizeName(e.observedName) !== normalizeName(canonical)) {
      try {
        await api.editForumTopic(
          toApiChatId(chat.chatId),
          e.messageThreadId,
          canonical,
        );
      } catch (err) {
        if (!isNotModified(err)) throw err;
      }
      await recordObservedTopic(executor, {
        chatId: chat.chatId,
        messageThreadId: e.messageThreadId,
        name: canonical,
        source: 'edited',
      });
    }
    await mapPace(tx, chat, e.paceGroupId, e.messageThreadId, canonical);
    return `Topic ${canonical} connected.`;
  });
}
