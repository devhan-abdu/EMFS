import type { Bot, Context } from 'grammy';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { handoffRecords } from '@/db/schema';
import { activateMembership } from '@/lib/services/membership';

import {
  consumeLinkCode,
  isChatLinked,
  markLinkCodePending,
} from '@/lib/services/telegram/connection';
import { syncNewBatchTopics } from '@/lib/services/telegram/topic-sync';
import { TelegramConnectionError } from '@/lib/services/telegram/errors';

import { isChatAdmin, isGroupChat } from '../guards';
import { memberCanManageTopics } from '@/lib/services/telegram/api-port';
import { toApiPort } from '../api-port-adapter';

type Outcome =
  { ok: true; text: string } | { ok: false; text: string; retry: boolean };

export async function attemptLink(
  ctx: Context,
  code: string,
): Promise<Outcome> {
  const chat = ctx.chat;

  if (!chat) {
    return { ok: false, text: 'No chat.', retry: false };
  }

  const chatId = BigInt(chat.id);

  try {
    const [info, me] = await Promise.all([
      ctx.getChat(),
      ctx.api.getChatMember(chat.id, ctx.me.id),
    ]);

    const { batchId, batchName, topicSyncMode } = await consumeLinkCode(db, {
      code,
      chatId,
      title: 'title' in info ? info.title : null,
      isForum: info.is_forum === true,
      canManageTopics: memberCanManageTopics({
        status: me.status,
        canManageTopics:
          'can_manage_topics' in me && me.can_manage_topics === true,
      }),
    });

    if (topicSyncMode === 'managed') {
      const report = await syncNewBatchTopics(db, toApiPort(ctx.api), batchId);

      return {
        ok: true,
        text: `Connected to "${batchName}".\n${report.join('\n')}`,
      };
    }

    return {
      ok: true,
      text: `Connected to "${batchName}".\nOpen the batch page in the system to configure the existing topic mappings.`,
    };
  } catch (error) {
    if (error instanceof TelegramConnectionError) {
      if (
        error.code === 'INVALID_OR_EXPIRED_CODE' ||
        error.code === 'CHAT_ALREADY_LINKED'
      ) {
        if (await isChatLinked(db, chatId)) {
          return { ok: true, text: 'This group is already connected.' };
        }
      }

      if (error.code === 'LINK_BLOCKED' || error.code === 'NOT_A_FORUM') {
        await markLinkCodePending(db, code, chatId);
        return {
          ok: false,
          retry: true,
          text: 'Almost there. First enable Topics in this group, then make me an admin with the Manage Topics permission. I will finish connecting automatically.',
        };
      }

      return { ok: false, text: error.message, retry: false };
    }

    console.error('[telegram] Unexpected group linking error:', {
      chatId: chatId.toString(),
      error,
    });

    throw error;
  }
}

async function handlePrivateStart(
  ctx: Context,
  payload: string,
  onMembershipActivated: () => void,
) {
  const chat = ctx.chat;

  if (!chat) return;

  if (!payload) {
    await ctx.reply(
      'Welcome! Please use the link provided after your application was approved.',
    );
    return;
  }

  const handoff = await db.query.handoffRecords.findFirst({
    where: and(eq(handoffRecords.code, payload), isNull(handoffRecords.usedAt)),
  });

  if (!handoff) {
    await ctx.reply(
      'This code is invalid or has already been used. Please contact your batch admin.',
    );
    return;
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(handoffRecords)
        .set({
          telegramChatId: BigInt(chat.id),
          usedAt: new Date(),
        })
        .where(
          and(eq(handoffRecords.id, handoff.id), isNull(handoffRecords.usedAt)),
        );

      await activateMembership(handoff.applicationId, null, tx);
    });

    onMembershipActivated();

    await ctx.reply(
      "You're linked and fully activated! Welcome to the batch 🎉",
    );
  } catch (error) {
    console.error('Bot activation failed:', error);

    await ctx.reply(
      'Something went wrong activating your membership. Please contact your batch admin.',
    );
  }
}

function isTelegramForbidden(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as {
    error_code?: number;
    message?: string;
    description?: string;
  };

  const message = `${err.message ?? ''} ${err.description ?? ''}`.toLowerCase();

  return (
    err.error_code === 403 ||
    message.includes('403') ||
    message.includes('bot was kicked') ||
    message.includes('forbidden')
  );
}

async function replySafely(ctx: Context, text: string) {
  try {
    await ctx.reply(text);
  } catch (error) {
    if (isTelegramForbidden(error)) {
      console.warn('[telegram] Cannot reply in this chat:', ctx.chat?.id);
      return;
    }

    throw error;
  }
}
async function handleGroupStart(ctx: Context, payload: string) {
  const chat = ctx.chat;

  if (!chat || !isGroupChat(ctx)) return;

  console.log('[telegram:start:group]', {
    chatId: chat.id,
    chatTitle: chat.title,
    fromId: ctx.from?.id,
    botId: ctx.me.id,
    updateId: ctx.update.update_id,
  });

  if (!payload) {
    await replySafely(
      ctx,
      'Please use the connection button in the EMFS system.',
    );
    return;
  }

  try {
    const isAdmin = await isChatAdmin(ctx);

    if (!isAdmin) {
      await replySafely(
        ctx,
        'Only a group administrator can connect this group.',
      );
      return;
    }
  } catch (error) {
    if (isTelegramForbidden(error)) {
      console.warn('[telegram:start] Cannot access group. Ignoring update.', {
        chatId: chat.id,
        updateId: ctx.update.update_id,
      });

      return;
    }

    throw error;
  }

  const outcome = await attemptLink(ctx, payload);

  await replySafely(ctx, outcome.text);
}

export function registerStartHandler(
  bot: Bot,
  onMembershipActivated: () => void,
) {
  bot.command('start', async (ctx) => {
    const chat = ctx.chat;

    if (!chat) return;

    const payload = ctx.match.trim();

    if (chat.type === 'private') {
      await handlePrivateStart(ctx, payload, onMembershipActivated);
      return;
    }

    if (chat.type === 'group' || chat.type === 'supergroup') {
      await handleGroupStart(ctx, payload);
      return;
    }
  });
}
