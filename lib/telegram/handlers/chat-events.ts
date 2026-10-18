import type { Bot } from 'grammy';
import { db } from '@/db';
import {
  applyBotMembershipChange,
  migrateChatId,
} from '@/lib/services/telegram/connection';

export function registerChatEventHandlers(bot: Bot) {
  // The bot was added / promoted / demoted / removed in a chat.
  bot.on('my_chat_member', async (ctx) => {
    const { chat, new_chat_member: member } = ctx.myChatMember;
    if (chat.type !== 'group' && chat.type !== 'supergroup') return;

    await applyBotMembershipChange(db, BigInt(chat.id), {
      status: member.status,
      canManageTopics:
        'can_manage_topics' in member && member.can_manage_topics === true,
    });
  });

  // Group upgraded to a supergroup (e.g. when Topics are turned on): new chat id.
  bot.on('message:migrate_to_chat_id', async (ctx) => {
    await migrateChatId(
      db,
      BigInt(ctx.chat.id),
      BigInt(ctx.msg.migrate_to_chat_id),
    );
  });
}
