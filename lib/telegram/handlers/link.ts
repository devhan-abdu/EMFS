import { eq } from 'drizzle-orm';
import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { db } from '@/db';
import { telegramChats } from '@/db/schema';
import { consumeLinkCode } from '@/lib/services/telegram/connection';
import { memberCanManageTopics } from '@/lib/services/telegram/api-port';
import { TelegramConnectionError } from '@/lib/services/telegram/errors';
import { parseLinkArgument } from '@/lib/validations/telegram';
import { isChatAdmin, isGroupChat } from '../guards';
import { syncNewBatchTopics } from '@/lib/services/telegram/topic-sync';
import { toApiPort } from '../api-port-adapter';

type Outcome =
  { ok: true; text: string } | { ok: false; text: string; retry: boolean };

async function attemptLink(ctx: Context, code: string): Promise<Outcome> {
  const chat = ctx.chat;
  if (!chat) return { ok: false, text: 'No chat.', retry: false };
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
        text: ` Connected to "${batchName}".\n${report.join('\n')}`,
      };
    }

    return {
      ok: true,
      text: ` Connected to "${batchName}".\nOpen the batch page in the system and press "Sync topics".`,
    };
  } catch (error) {
    if (error instanceof TelegramConnectionError) {
      if (
        error.code === 'INVALID_OR_EXPIRED_CODE' ||
        error.code === 'CHAT_ALREADY_LINKED'
      ) {
        // Telegram may deliver an update twice: already linked means success.
        const already = await db.query.telegramChats.findFirst({
          where: eq(telegramChats.chatId, chatId),
          columns: { id: true },
        });
        if (already)
          return { ok: true, text: 'This group is already connected.' };
      }
      return {
        ok: false,
        text: error.message,
        retry: false,
      };
    }
    console.error('telegram link failed:', error);
    return {
      ok: false,
      text: 'Something went wrong. Press the button in the system again.',
      retry: false,
    };
  }
}

export async function linkGroup(ctx: Context, code: string | null) {
  if (!code) {
    await ctx.reply(
      'Use the "Add bot to Telegram group" button on your batch page in the system.',
    );
    return;
  }
  const outcome = await attemptLink(ctx, code);
  if (outcome.ok) {
    await ctx.reply(outcome.text);
    return;
  }
  await ctx.reply(
    ` Cannot connect yet:\n${outcome.text}`,
    outcome.retry
      ? {
          reply_markup: new InlineKeyboard().text(' Check again', `lk:${code}`),
        }
      : undefined,
  );
}

export function registerLinkHandler(bot: Bot) {
  // "Check again": popup alert on failure, message edit on success.
  bot.callbackQuery(/^lk:([A-Za-z0-9_-]{1,64})$/, async (ctx) => {
    if (!isGroupChat(ctx) || !(await isChatAdmin(ctx))) {
      await ctx.answerCallbackQuery({
        text: 'Only group admins can do this.',
        show_alert: true,
      });
      return;
    }
    const outcome = await attemptLink(ctx, ctx.match[1]);
    if (outcome.ok) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(outcome.text);
      return;
    }
    await ctx.answerCallbackQuery({
      text: outcome.text.slice(0, 200),
      show_alert: true,
    });
  });

  bot.command('link', async (ctx) => {
    if (!isGroupChat(ctx) || !(await isChatAdmin(ctx))) return;
    await linkGroup(ctx, parseLinkArgument(ctx.match));
  });
}
