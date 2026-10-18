import type { Bot } from 'grammy';
import { db } from '@/db';
import { consumeLinkCode } from '@/lib/services/telegram/connection';
import { memberCanManageTopics } from '@/lib/services/telegram/api-port';
import { TelegramConnectionError } from '@/lib/services/telegram/errors';
import { parseLinkArgument } from '@/lib/validations/telegram';
import { isChatAdmin, isGroupChat } from '../guards';

export function registerLinkHandler(bot: Bot) {
  bot.command('link', async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply(
        'Send /link CODE inside the Telegram group you want to connect.',
      );
      return;
    }
    if (!(await isChatAdmin(ctx))) {
      await ctx.reply('Only group admins can link this group.');
      return;
    }

    const code = parseLinkArgument(ctx.match);
    if (!code) {
      await ctx.reply(
        'Usage: /link CODE\nGet the code from the Telegram card on your batch page in the system.',
      );
      return;
    }

    try {
      const [chatInfo, botMember] = await Promise.all([
        ctx.getChat(),
        ctx.api.getChatMember(ctx.chat.id, ctx.me.id),
      ]);

      const canManageTopics = memberCanManageTopics({
        status: botMember.status,
        canManageTopics:
          'can_manage_topics' in botMember &&
          botMember.can_manage_topics === true,
      });

      const { chat, batchName } = await consumeLinkCode(db, {
        code,
        chatId: BigInt(ctx.chat.id),
        title: 'title' in chatInfo ? chatInfo.title : null,
        isForum: chatInfo.is_forum === true,
        canManageTopics,
      });

      const lines = [`✅ Linked to ${batchName}.`];
      if (!chat.canManageTopics) {
        lines.push(
          '⚠️ Make me an admin with the "Manage topics" right so the system can create pace group topics.',
        );
      }
      lines.push(
        'Next: in the system, open the batch Telegram card and create the pace group topics.',
        'Already have topics? Send /topic pace <pace group name> inside each one.',
      );
      await ctx.reply(lines.join('\n'));
    } catch (error) {
      if (error instanceof TelegramConnectionError) {
        await ctx.reply(`❌ ${error.message}`);
        return;
      }
      console.error('telegram /link failed:', error);
      await ctx.reply('Something went wrong linking this group. Try again.');
    }
  });
}
