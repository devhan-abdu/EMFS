import type { Bot } from 'grammy';
import { db } from '@/db';
import {
  applyBotMembershipChange,
  findPendingLinkCode,
  migrateChatId,
} from '@/lib/services/telegram/connection';
import { attemptLink } from './start';
import { restoreLinkedChat } from '@/lib/services/telegram/topic-sync';
import { toApiPort } from '../api-port-adapter';
import { describeTelegramError } from '@/lib/services/telegram/errors';

export function registerChatEventHandlers(bot: Bot) {
  bot.on('my_chat_member', async (ctx) => {
    const { chat, new_chat_member: member } = ctx.myChatMember;
    if (chat.type !== 'group' && chat.type !== 'supergroup') return;

    const canManageTopics =
      member.status === 'administrator' &&
      'can_manage_topics' in member &&
      member.can_manage_topics === true;

    const change = await applyBotMembershipChange(db, BigInt(chat.id), {
      status: member.status,
      canManageTopics,
    });

    // Linked group, and the bot just (re)gained Manage Topics.
    if (change?.gainedTopicRights) {
      try {
        await restoreLinkedChat(db, toApiPort(ctx.api), change.batchId);
      } catch (error) {
        // Best effort. The new status is already saved, so a retried update
        // would not run this again; the admin can press Re-check instead.
        console.error(
          '[telegram] restoreLinkedChat failed:',
          describeTelegramError(error),
        );
      }
      return;
    }

    if (!canManageTopics) return;

    // A /start CODE was sent here before the bot had its rights: finish linking now.
    const pending = await findPendingLinkCode(db, BigInt(chat.id));
    if (!pending) return;

    const outcome = await attemptLink(ctx, pending.code);
    await ctx.reply(outcome.text).catch(() => {});
  });

  bot.on('message:migrate_to_chat_id', async (ctx) => {
    await migrateChatId(
      db,
      BigInt(ctx.chat.id),
      BigInt(ctx.msg.migrate_to_chat_id),
    );
  });
}
