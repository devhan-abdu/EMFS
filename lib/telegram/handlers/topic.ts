import type { Bot } from 'grammy';
import { db } from '@/db';
import {
  mapAnnouncementTopic,
  mapPaceTopic,
  unmapTopic,
} from '@/lib/services/telegram/topics';
import { TelegramConnectionError } from '@/lib/services/telegram/errors';
import { parseTopicCommand } from '@/lib/validations/telegram';
import { isChatAdmin, isGroupChat } from '../guards';

const USAGE = [
  'Send this inside the topic you want to map:',
  '/topic pace <pace group name>',
  '/topic announcement',
  '/topic unmap',
].join('\n');

export function registerTopicHandler(bot: Bot) {
  bot.command('topic', async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply('Send /topic inside a topic of your linked group.');
      return;
    }
    if (!(await isChatAdmin(ctx))) {
      await ctx.reply('Only group admins can map topics.');
      return;
    }

    const threadId = ctx.msg.message_thread_id;
    if (!ctx.msg.is_topic_message || threadId === undefined) {
      await ctx.reply(
        'Send this command inside a topic (the General topic cannot be mapped).',
      );
      return;
    }

    const command = parseTopicCommand(ctx.match);
    if (!command) {
      await ctx.reply(USAGE);
      return;
    }

    const chatId = BigInt(ctx.chat.id);
    try {
      if (command.kind === 'pace') {
        const { paceGroupName } = await mapPaceTopic(db, {
          chatId,
          messageThreadId: threadId,
          paceGroupName: command.name,
        });
        await ctx.reply(`✅ This topic is now the topic for ${paceGroupName}.`);
      } else if (command.kind === 'announcement') {
        await mapAnnouncementTopic(db, { chatId, messageThreadId: threadId });
        await ctx.reply('✅ This topic is now the announcements topic.');
      } else {
        const removed = await unmapTopic(db, {
          chatId,
          messageThreadId: threadId,
        });
        await ctx.reply(
          removed ? '✅ Mapping removed.' : 'This topic was not mapped.',
        );
      }
    } catch (error) {
      if (error instanceof TelegramConnectionError) {
        await ctx.reply(`❌ ${error.message}`);
        return;
      }
      console.error('telegram /topic failed:', error);
      await ctx.reply('Something went wrong mapping this topic. Try again.');
    }
  });
}
