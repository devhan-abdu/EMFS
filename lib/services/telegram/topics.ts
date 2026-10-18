import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import {
  batches,
  paceGroups,
  telegramChats,
  telegramChatTopics,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import {
  batchIdSchema,
  groupChatIdSchema,
  threadIdSchema,
} from '@/lib/validations/telegram';
import {
  TelegramConnectionError,
  describeTelegramError,
  isUniqueViolation,
} from './errors';
import { MAX_PACE_GROUPS_LISTED } from './connection';
import { toApiChatId, type TelegramApiPort } from './api-port';

async function requireChatByChatId(executor: DbOrTx, chatId: bigint) {
  groupChatIdSchema.parse(chatId);
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.chatId, chatId),
  });
  if (!chat) {
    throw new TelegramConnectionError(
      'NOT_CONNECTED',
      'This group is not linked to a batch yet. Use /link CODE first.',
    );
  }
  return chat;
}

/** Escapes LIKE wildcards so a pace group name is matched literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

/**
 * Existing-topic path: `/topic pace <name>` was sent inside a topic.
 * The Bot API cannot list topics, so the bot learns the thread id from this message.
 */
export async function mapPaceTopic(
  executor: DbOrTx,
  input: { chatId: bigint; messageThreadId: number; paceGroupName: string },
) {
  const threadId = threadIdSchema.parse(input.messageThreadId);
  const chat = await requireChatByChatId(executor, input.chatId);

  const group = await executor.query.paceGroups.findFirst({
    where: and(
      eq(paceGroups.batchId, chat.batchId),
      eq(paceGroups.archived, false),
      ilike(paceGroups.name, escapeLike(input.paceGroupName.trim())),
    ),
    columns: { id: true, name: true },
  });
  if (!group) {
    const names = await executor.query.paceGroups.findMany({
      where: and(
        eq(paceGroups.batchId, chat.batchId),
        eq(paceGroups.archived, false),
      ),
      columns: { name: true },
      orderBy: asc(paceGroups.name),
      limit: 20,
    });
    throw new TelegramConnectionError(
      'PACE_GROUP_NOT_FOUND',
      `No pace group named "${input.paceGroupName}" in this batch. Available: ${names.map((n) => n.name).join(', ') || 'none'}.`,
    );
  }

  return executor.transaction(async (tx) => {
    const existing = await tx.query.telegramChatTopics.findFirst({
      where: and(
        eq(telegramChatTopics.telegramChatId, chat.id),
        eq(telegramChatTopics.messageThreadId, threadId),
      ),
    });
    if (existing && existing.paceGroupId !== group.id) {
      throw new TelegramConnectionError(
        'TOPIC_ALREADY_MAPPED',
        'This topic is already mapped to something else. Send /topic unmap here first.',
      );
    }

    try {
      // Re-mapping a pace group to a different topic replaces the old mapping.
      await tx
        .delete(telegramChatTopics)
        .where(eq(telegramChatTopics.paceGroupId, group.id));
      await tx.insert(telegramChatTopics).values({
        telegramChatId: chat.id,
        messageThreadId: threadId,
        kind: 'pace_group',
        paceGroupId: group.id,
        name: group.name,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new TelegramConnectionError(
          'TOPIC_ALREADY_MAPPED',
          'This topic is already mapped.',
        );
      }
      throw error;
    }
    return { paceGroupName: group.name };
  });
}

export async function mapAnnouncementTopic(
  executor: DbOrTx,
  input: { chatId: bigint; messageThreadId: number },
) {
  const threadId = threadIdSchema.parse(input.messageThreadId);
  const chat = await requireChatByChatId(executor, input.chatId);

  await executor.transaction(async (tx) => {
    const existing = await tx.query.telegramChatTopics.findFirst({
      where: and(
        eq(telegramChatTopics.telegramChatId, chat.id),
        eq(telegramChatTopics.messageThreadId, threadId),
      ),
    });
    if (existing && existing.kind !== 'announcement') {
      throw new TelegramConnectionError(
        'TOPIC_ALREADY_MAPPED',
        'This topic is already mapped to a pace group. Send /topic unmap here first.',
      );
    }
    await tx
      .delete(telegramChatTopics)
      .where(
        and(
          eq(telegramChatTopics.telegramChatId, chat.id),
          eq(telegramChatTopics.kind, 'announcement'),
        ),
      );
    await tx.insert(telegramChatTopics).values({
      telegramChatId: chat.id,
      messageThreadId: threadId,
      kind: 'announcement',
      name: 'Announcements',
    });
  });
}

/** Returns true when a mapping existed for that topic. */
export async function unmapTopic(
  executor: DbOrTx,
  input: { chatId: bigint; messageThreadId: number },
) {
  const threadId = threadIdSchema.parse(input.messageThreadId);
  const chat = await requireChatByChatId(executor, input.chatId);
  const deleted = await executor
    .delete(telegramChatTopics)
    .where(
      and(
        eq(telegramChatTopics.telegramChatId, chat.id),
        eq(telegramChatTopics.messageThreadId, threadId),
      ),
    )
    .returning({ id: telegramChatTopics.id });
  return deleted.length > 0;
}

export type CreateTopicsResult = {
  created: string[];
  failed: { name: string; reason: string } | null;
};

/**
 * System side: creates a forum topic for every pace group of the batch that has none.
 * Safe to run twice: an advisory lock serializes concurrent runs per batch, and each
 * topic is saved as soon as Telegram creates it, so a failure part-way keeps the
 * topics already made. Stops at the first Telegram error to avoid spamming the group.
 */
export async function createMissingPaceTopics(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
): Promise<CreateTopicsResult> {
  batchIdSchema.parse(batchId);

  return executor.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`telegram-topics:${batchId}`}))`,
    );

    const chat = await tx.query.telegramChats.findFirst({
      where: eq(telegramChats.batchId, batchId),
    });
    if (!chat) {
      throw new TelegramConnectionError(
        'NOT_CONNECTED',
        'This batch has no Telegram group.',
      );
    }
    if (chat.status !== 'active') {
      throw new TelegramConnectionError(
        'TELEGRAM_API_ERROR',
        'The bot is no longer in the group. Re-add it as admin, then use "Re-check".',
      );
    }
    if (!chat.isForum) {
      throw new TelegramConnectionError(
        'NOT_A_FORUM',
        'Topics are not enabled in the group. Turn them on, then use "Re-check".',
      );
    }
    if (!chat.canManageTopics) {
      throw new TelegramConnectionError(
        'TELEGRAM_API_ERROR',
        'The bot needs the "Manage topics" admin right. Grant it, then use "Re-check".',
      );
    }

    const [groups, mapped] = await Promise.all([
      tx.query.paceGroups.findMany({
        where: and(
          eq(paceGroups.batchId, batchId),
          eq(paceGroups.archived, false),
        ),
        columns: { id: true, name: true },
        orderBy: asc(paceGroups.name),
        limit: MAX_PACE_GROUPS_LISTED,
      }),
      tx.query.telegramChatTopics.findMany({
        where: eq(telegramChatTopics.telegramChatId, chat.id),
        columns: { paceGroupId: true },
      }),
    ]);
    const mappedIds = new Set(mapped.map((m) => m.paceGroupId));
    const missing = groups.filter((g) => !mappedIds.has(g.id));

    const result: CreateTopicsResult = { created: [], failed: null };
    for (const group of missing) {
      try {
        const topic = await api.createForumTopic(
          toApiChatId(chat.chatId),
          group.name,
        );
        await tx.insert(telegramChatTopics).values({
          telegramChatId: chat.id,
          messageThreadId: topic.messageThreadId,
          kind: 'pace_group',
          paceGroupId: group.id,
          name: group.name,
        });
        result.created.push(group.name);
      } catch (error) {
        result.failed = {
          name: group.name,
          reason: describeTelegramError(error),
        };
        break;
      }
    }
    return result;
  });
}

/** Posts a confirmation into the announcement topic (or General) to prove the link works. */
export async function sendTestMessage(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
) {
  batchIdSchema.parse(batchId);
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.batchId, batchId),
  });
  if (!chat) {
    throw new TelegramConnectionError(
      'NOT_CONNECTED',
      'This batch has no Telegram group.',
    );
  }
  const [batch, announcement] = await Promise.all([
    executor.query.batches.findFirst({
      where: eq(batches.id, batchId),
      columns: { name: true },
    }),
    executor.query.telegramChatTopics.findFirst({
      where: and(
        eq(telegramChatTopics.telegramChatId, chat.id),
        eq(telegramChatTopics.kind, 'announcement'),
      ),
    }),
  ]);

  try {
    await api.sendMessage(
      toApiChatId(chat.chatId),
      `✅ EMFS Book Shelf is connected to ${batch?.name ?? 'this batch'}.`,
      announcement?.messageThreadId,
    );
  } catch (error) {
    throw new TelegramConnectionError(
      'TELEGRAM_API_ERROR',
      `Telegram rejected the message: ${describeTelegramError(error)}`,
    );
  }
}
