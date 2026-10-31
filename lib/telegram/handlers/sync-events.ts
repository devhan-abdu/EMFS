import type { Bot } from 'grammy';
import { db } from '@/db';
import {
  applyTelegramTitleChange,
  applyTelegramTopicRename,
} from '@/lib/services/telegram/inbound-sync';
import { toApiPort } from '../api-port-adapter';

export function registerSyncEventHandlers(bot: Bot) {
  bot.on('message:new_chat_title', async (ctx) => {
    if (ctx.from?.id === ctx.me.id) return; // our own change echoing back
    await applyTelegramTitleChange(db, {
      chatId: BigInt(ctx.chat.id),
      title: ctx.msg.new_chat_title,
    });
  });

  bot.on('message:forum_topic_edited', async (ctx) => {
    const name = ctx.msg.forum_topic_edited.name; // undefined when only the icon changed
    const threadId = ctx.msg.message_thread_id;
    if (!name || threadId === undefined || ctx.from?.id === ctx.me.id) return;
    await applyTelegramTopicRename(db, toApiPort(ctx.api), {
      chatId: BigInt(ctx.chat.id),
      messageThreadId: threadId,
      newName: name,
    });
  });
}
