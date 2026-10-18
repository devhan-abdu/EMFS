import { and, asc, eq, isNull, gt } from 'drizzle-orm';
import {
  batches,
  paceGroups,
  telegramChats,
  telegramChatTopics,
  telegramLinkCodes,
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

/**
 * Bot side: `/link CODE` was sent in a group. Burns the code and binds the chat
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
    const [used] = await tx
      .update(telegramLinkCodes)
      .set({ usedAt: now })
      .where(
        and(
          eq(telegramLinkCodes.code, code),
          isNull(telegramLinkCodes.usedAt),
          gt(telegramLinkCodes.expiresAt, now),
        ),
      )
      .returning();
    if (!used) {
      throw new TelegramConnectionError(
        'INVALID_OR_EXPIRED_CODE',
        'This link code is invalid, expired or already used.',
      );
    }

    const batch = await tx.query.batches.findFirst({
      where: eq(batches.id, used.batchId),
      columns: { id: true, name: true },
    });
    if (!batch) {
      throw new TelegramConnectionError('BATCH_NOT_FOUND', 'Batch not found.');
    }

    if (
      await tx.query.telegramChats.findFirst({
        where: eq(telegramChats.chatId, chatId),
        columns: { id: true },
      })
    ) {
      throw new TelegramConnectionError(
        'CHAT_ALREADY_LINKED',
        'This Telegram group is already linked to a batch.',
      );
    }
    if (
      await tx.query.telegramChats.findFirst({
        where: eq(telegramChats.batchId, batch.id),
        columns: { id: true },
      })
    ) {
      throw new TelegramConnectionError(
        'BATCH_ALREADY_LINKED',
        'This batch already has a Telegram group. Disconnect it in the system first.',
      );
    }

    if (!isForum) {
      throw new TelegramConnectionError(
        'NOT_A_FORUM',
        'Topics are not enabled in this group. Turn on Topics in the group settings, then send /link again with the same code.',
      );
    }

    try {
      const [chat] = await tx
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
      return { chat, batchName: batch.name };
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

export type TelegramConnectionView =
  | {
      connected: false;
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
    };

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
  if (!chat) {
    const active = await findActiveLinkCode(executor, batchId, now);
    return {
      connected: false,
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

  const [groups, topics] = await Promise.all([
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
  };
}

/** Removes the link (and its topic mappings). Does not remove the bot from Telegram. */
export async function disconnect(executor: DbOrTx, batchId: string) {
  batchIdSchema.parse(batchId);
  const deleted = await executor
    .delete(telegramChats)
    .where(eq(telegramChats.batchId, batchId))
    .returning({ id: telegramChats.id });
  return deleted.length > 0;
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
    const stillIn =
      member.status === 'creator' ||
      member.status === 'administrator' ||
      member.status === 'member' ||
      member.status === 'restricted';
    await executor
      .update(telegramChats)
      .set({
        title: info.title ?? chat.title,
        isForum: info.isForum,
        canManageTopics: memberCanManageTopics(member),
        status: stillIn ? 'active' : 'bot_removed',
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
  const stillIn =
    change.status === 'creator' ||
    change.status === 'administrator' ||
    change.status === 'member' ||
    change.status === 'restricted';
  await executor
    .update(telegramChats)
    .set({
      status: stillIn ? 'active' : 'bot_removed',
      canManageTopics: memberCanManageTopics(change),
      updatedAt: new Date(),
    })
    .where(eq(telegramChats.chatId, chatId));
}

/** Group upgraded to a supergroup: Telegram gives it a new id. */
export async function migrateChatId(
  executor: DbOrTx,
  oldChatId: bigint,
  newChatId: bigint,
) {
  await executor
    .update(telegramChats)
    .set({ chatId: newChatId, updatedAt: new Date() })
    .where(eq(telegramChats.chatId, oldChatId));
}
