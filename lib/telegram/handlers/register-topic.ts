import type { Bot } from 'grammy';

import { db } from '@/db';

import {
  registerDiscoveredTopic,
  TelegramTopicDiscoveryError,
} from '@/lib/services/telegram/topic-discovery';
import { telegramTopicNameSchema } from '@/lib/validations/telegram';

import { isChatAdmin, isGroupChat } from '../guards';

export function registerTopicHandler(bot: Bot) {
  bot.command('register_topic', async (ctx) => {
    const chat = ctx.chat;
    const message = ctx.msg;

    // Only group and supergroup messages are supported.
    if (!chat || !isGroupChat(ctx)) {
      return;
    }

    // Only Telegram group administrators can register topics.
    if (!(await isChatAdmin(ctx))) {
      await ctx.reply(
        'Only a group administrator can register an existing topic.',
      );
      return;
    }

    // A message sent inside a forum topic contains message_thread_id.
    const messageThreadId = message.message_thread_id;

    if (messageThreadId === undefined) {
      await ctx.reply(
        'Please run /register_topic <topic name> inside the topic you want to register.',
      );
      return;
    }

    const parsedTopicName = telegramTopicNameSchema.safeParse(ctx.match);
    if (!parsedTopicName.success) {
      await ctx.reply(
        'Usage: /register_topic <topic name>. Send it inside the topic you want to register.',
        { message_thread_id: messageThreadId },
      );
      return;
    }

    try {
      const result = await registerDiscoveredTopic(db, {
        chatId: BigInt(chat.id),
        messageThreadId,
        topicName: parsedTopicName.data,
      });

      await ctx.reply(
        result.registered
          ? `“${parsedTopicName.data}” registered. You can now create its pace group in EMFS.`
          : result.message,
        {
          message_thread_id: messageThreadId,
        },
      );
    } catch (error) {
      if (error instanceof TelegramTopicDiscoveryError) {
        await ctx.reply(error.message, {
          message_thread_id: messageThreadId,
        });
        return;
      }

      console.error('Topic registration failed:', error);

      await ctx.reply(
        'Something went wrong while registering this topic. Please try again.',
        {
          message_thread_id: messageThreadId,
        },
      );
    }
  });
}
