import { and, asc, eq, isNull, gt } from 'drizzle-orm';
import {
  batches,
  paceGroups,
  telegramChats,
  telegramChatTopics,
  telegramLinkCodes,
  telegramTopicDiscoveries,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import {
  batchIdSchema,
  consumeLinkCodeSchema,
  type ConsumeLinkCodeInput,
} from '@/lib/validations/telegram';
import {
  TelegramConnectionError,
  describeTelegramError,
  isUniqueViolation,
} from './errors';
import {
  memberCanManageTopics,
  toApiChatId,
  type TelegramApiPort,
} from './api-port';
import { findActiveLinkCode } from './link-codes';

/** Documented cap: a batch has a handful of pace groups. */
export const MAX_PACE_GROUPS_LISTED = 200;

const INVALID_CODE_MESSAGE =
  'This link code is invalid, expired or already used.';

/** Telegram member statuses that mean the bot is still in the chat. */
function isBotStillIn(status: string) {
  return (
    status === 'creator' ||
    status === 'administrator' ||
    status === 'member' ||
    status === 'restricted'
  );
}

/**
 * Bot side: `/start CODE` was sent in a group. Burns the code and binds the chat
 * to the code's batch in ONE transaction, so a failed bind never consumes the code.
 */
export async function consumeLinkCode(
  executor: DbOrTx,
  input: ConsumeLinkCodeInput,
  now: Date = new Date(),
) {
  const { code, chatId, title, isForum, canManageTopics } =
    consumeLinkCodeSchema.parse(input);

  return executor.transaction(async (tx) => {
    // 1. Find which batch this code belongs to.
    const linkCode = await tx.query.telegramLinkCodes.findFirst({
      where: eq(telegramLinkCodes.code, code),
      columns: {
        id: true,
        batchId: true,
        createdBy: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!linkCode) {
      throw new TelegramConnectionError(
        'INVALID_OR_EXPIRED_CODE',
        INVALID_CODE_MESSAGE,
      );
    }

    const [batch] = await tx
      .select({
        id: batches.id,
        name: batches.name,
        telegramTopicSyncMode: batches.telegramTopicSyncMode,
      })
      .from(batches)
      .where(eq(batches.id, linkCode.batchId))
      .for('update');

    if (!batch) {
      throw new TelegramConnectionError('BATCH_NOT_FOUND', 'Batch not found.');
    }

    // 3. Validate Telegram group requirements.
    if (!isForum) {
      throw new TelegramConnectionError(
        'NOT_A_FORUM',
        'Enable Topics in this Telegram group and try again.',
      );
    }

    if (!canManageTopics) {
      throw new TelegramConnectionError(
        'LINK_BLOCKED',
        'The bot must be an administrator with Manage Topics permission.',
      );
    }

    // 4. Atomically consume the code.
    const [used] = await tx
      .update(telegramLinkCodes)
      .set({ usedAt: now })
      .where(
        and(
          eq(telegramLinkCodes.code, code),
          eq(telegramLinkCodes.batchId, batch.id),
          isNull(telegramLinkCodes.usedAt),
          gt(telegramLinkCodes.expiresAt, now),
        ),
      )
      .returning({
        createdBy: telegramLinkCodes.createdBy,
      });

    if (!used) {
      throw new TelegramConnectionError(
        'INVALID_OR_EXPIRED_CODE',
        INVALID_CODE_MESSAGE,
      );
    }

    const groupLink = await findChatLink(tx, chatId);

    if (groupLink && groupLink.batchId !== batch.id) {
      throw new TelegramConnectionError(
        'CHAT_ALREADY_LINKED',
        'This Telegram group is already linked to a batch.',
      );
    }

    // 6. This batch must not already have an active group.
    //    A 'bot_removed' row is allowed: it is being reconnected.
    const current = await tx.query.telegramChats.findFirst({
      where: eq(telegramChats.batchId, batch.id),
      columns: { id: true, chatId: true, status: true },
    });

    if (current?.status === 'active') {
      throw new TelegramConnectionError(
        'BATCH_ALREADY_LINKED',
        'This batch already has a Telegram group.',
      );
    }

    try {
      if (current && current.chatId !== chatId) {
        await tx.delete(telegramChats).where(eq(telegramChats.id, current.id));
      }

      const [chat] =
        current && current.chatId === chatId
          ? await tx
              .update(telegramChats)
              .set({
                title,
                isForum,
                canManageTopics,
                status: 'active',
                linkedBy: used.createdBy,
                linkedAt: now,
                updatedAt: now,
              })
              .where(eq(telegramChats.id, current.id))
              .returning()
          : await tx
              .insert(telegramChats)
              .values({
                chatId,
                batchId: batch.id,
                title,
                isForum,
                canManageTopics,
                linkedBy: used.createdBy,
              })
              .returning();

      return {
        chat,
        batchName: batch.name,
        batchId: batch.id,
        topicSyncMode: batch.telegramTopicSyncMode,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new TelegramConnectionError(
          'CHAT_ALREADY_LINKED',
          'This Telegram group or batch is already linked.',
        );
      }

      throw error;
    }
  });
}
/**
 * The group wasn't ready (Topics off or bot not admin yet). Remember which chat
 * the code was used in so linking can retry once the bot is promoted.
 * Runs outside the consume transaction on purpose: a rollback must not erase it.
 */
export async function markLinkCodePending(
  executor: DbOrTx,
  code: string,
  chatId: bigint,
) {
  await executor
    .update(telegramLinkCodes)
    .set({ pendingChatId: chatId })
    .where(
      and(eq(telegramLinkCodes.code, code), isNull(telegramLinkCodes.usedAt)),
    );
}

/** The active, unused code waiting for this chat, if any. */
export async function findPendingLinkCode(
  executor: DbOrTx,
  chatId: bigint,
  now: Date = new Date(),
) {
  return executor.query.telegramLinkCodes.findFirst({
    where: and(
      eq(telegramLinkCodes.pendingChatId, chatId),
      isNull(telegramLinkCodes.usedAt),
      gt(telegramLinkCodes.expiresAt, now),
    ),
    columns: { code: true },
  });
}

/** True when this Telegram chat is already linked to a batch. */
async function findChatLink(executor: DbOrTx, chatId: bigint) {
  return executor.query.telegramChats.findFirst({
    where: eq(telegramChats.chatId, chatId),
    columns: { id: true, batchId: true, status: true },
  });
}

/** True when this chat is linked and the bot is still in it. */
export async function isChatLinked(executor: DbOrTx, chatId: bigint) {
  const row = await findChatLink(executor, chatId);
  return row?.status === 'active';
}

export type TelegramConnectionView =
  | {
      connected: false;
      botRemoved: boolean;
      previousTitle: string | null;
      activeCode: { code: string; expiresAt: Date; minutesLeft: number } | null;
    }
  | {
      connected: true;
      chat: {
        title: string | null;
        isForum: boolean;
        status: 'active' | 'bot_removed';
        canManageTopics: boolean;
        linkedAt: Date;
      };
      announcementThreadId: number | null;
      paceGroups: {
        id: string;
        name: string;
        messageThreadId: number | null;
      }[];
      discoveredTopics: {
        id: string;
        messageThreadId: number;
        topicName: string | null;
      }[];
    };

export type TelegramNotConnected = Extract<
  TelegramConnectionView,
  { connected: false }
>;
export type TelegramConnected = Extract<
  TelegramConnectionView,
  { connected: true }
>;

/** Read model for the admin card. Never exposes the raw chat id to the browser. */
export async function getConnection(
  executor: DbOrTx,
  batchId: string,
  now: Date = new Date(),
): Promise<TelegramConnectionView> {
  batchIdSchema.parse(batchId);

  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.batchId, batchId),
  });
  if (!chat || chat.status === 'bot_removed') {
    const active = await findActiveLinkCode(executor, batchId, now);
    return {
      connected: false,
      botRemoved: chat !== undefined,
      previousTitle: chat?.title ?? null,
      activeCode: active
        ? {
            code: active.code,
            expiresAt: active.expiresAt,
            minutesLeft: Math.max(
              1,
              Math.ceil((active.expiresAt.getTime() - now.getTime()) / 60_000),
            ),
          }
        : null,
    };
  }

  const [groups, topics, discoveries] = await Promise.all([
    executor.query.paceGroups.findMany({
      where: and(
        eq(paceGroups.batchId, batchId),
        eq(paceGroups.archived, false),
      ),
      columns: { id: true, name: true },
      orderBy: asc(paceGroups.name),
      limit: MAX_PACE_GROUPS_LISTED,
    }),
    executor.query.telegramChatTopics.findMany({
      where: eq(telegramChatTopics.telegramChatId, chat.id),
    }),
    executor.query.telegramTopicDiscoveries.findMany({
      where: eq(telegramTopicDiscoveries.telegramChatId, chat.id),
      orderBy: asc(telegramTopicDiscoveries.messageThreadId),
      limit: MAX_PACE_GROUPS_LISTED,
    }),
  ]);

  const threadByGroup = new Map(
    topics
      .filter((t) => t.paceGroupId !== null)
      .map((t) => [t.paceGroupId as string, t.messageThreadId]),
  );

  return {
    connected: true,
    chat: {
      title: chat.title,
      isForum: chat.isForum,
      status: chat.status,
      canManageTopics: chat.canManageTopics,
      linkedAt: chat.linkedAt,
    },
    announcementThreadId:
      topics.find((t) => t.kind === 'announcement')?.messageThreadId ?? null,
    paceGroups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      messageThreadId: threadByGroup.get(g.id) ?? null,
    })),
    discoveredTopics: discoveries.map((topic) => ({
      id: topic.id,
      messageThreadId: topic.messageThreadId,
      topicName: topic.topicName,
    })),
  };
}

/** Removes the link (and its topic mappings). Does not remove the bot from Telegram. */
export async function disconnect(
  executor: DbOrTx,
  api: Pick<TelegramApiPort, 'leaveChat'>,
  batchId: string,
) {
  batchIdSchema.parse(batchId);

  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.batchId, batchId),
    columns: { id: true, chatId: true, status: true },
  });
  if (!chat) return false;

  if (chat.status === 'active') {
    try {
      await api.leaveChat(toApiChatId(chat.chatId));
    } catch (error) {
      console.warn(
        '[telegram] leaveChat failed:',
        describeTelegramError(error),
      );
    }
  }

  await executor
    .update(telegramChats)
    .set({
      status: 'bot_removed',
      canManageTopics: false,
      updatedAt: new Date(),
    })
    .where(eq(telegramChats.id, chat.id));

  return true;
}

/**
 * Re-reads group info from Telegram (title, Topics on/off, bot rights) so the
 * admin card reflects reality after the group was changed.
 */
export async function syncChatInfo(
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

  const apiChatId = toApiChatId(chat.chatId);
  try {
    const [info, me] = await Promise.all([api.getChat(apiChatId), api.getMe()]);
    const member = await api.getChatMember(apiChatId, me.id);
    await executor
      .update(telegramChats)
      .set({
        title: info.title ?? chat.title,
        isForum: info.isForum,
        canManageTopics: memberCanManageTopics(member),
        status: isBotStillIn(member.status) ? 'active' : 'bot_removed',
        updatedAt: new Date(),
      })
      .where(eq(telegramChats.id, chat.id));
  } catch (error) {
    if (error instanceof TelegramConnectionError) throw error;
    // Chat unreachable (bot kicked, group deleted).
    await executor
      .update(telegramChats)
      .set({
        status: 'bot_removed',
        canManageTopics: false,
        updatedAt: new Date(),
      })
      .where(eq(telegramChats.id, chat.id));
    throw new TelegramConnectionError(
      'TELEGRAM_API_ERROR',
      `Telegram could not reach the group: ${describeTelegramError(error)}`,
    );
  }
}

/** `my_chat_member` update: the bot was added, promoted, demoted or removed. */
export async function applyBotMembershipChange(
  executor: DbOrTx,
  chatId: bigint,
  change: { status: string; canManageTopics: boolean },
) {
  const before = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.chatId, chatId),
    columns: { id: true, batchId: true, canManageTopics: true },
  });
  if (!before) return null;

  const canManageTopics = memberCanManageTopics(change);

  await executor
    .update(telegramChats)
    .set({
      status: isBotStillIn(change.status) ? 'active' : 'bot_removed',
      canManageTopics,
      updatedAt: new Date(),
    })
    .where(eq(telegramChats.id, before.id));

  return {
    batchId: before.batchId,
    gainedTopicRights: canManageTopics && !before.canManageTopics,
  };
}

/** Group upgraded to a supergroup: Telegram gives it a new id. */

export async function migrateChatId(
  executor: DbOrTx,
  oldChatId: bigint,
  newChatId: bigint,
) {
  await executor.transaction(async (tx) => {
    await tx
      .update(telegramChats)
      .set({ chatId: newChatId, updatedAt: new Date() })
      .where(eq(telegramChats.chatId, oldChatId));

    // A code waiting for the old id now waits for the new one.
    await tx
      .update(telegramLinkCodes)
      .set({ pendingChatId: newChatId })
      .where(eq(telegramLinkCodes.pendingChatId, oldChatId));
  });
}
