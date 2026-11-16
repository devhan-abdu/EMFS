import type { Context } from 'grammy';

/**
 * True when the sender of the current message is a Telegram admin of the chat.
 * Anonymous-admin messages carry sender_chat.id === chat.id, which only chat admins
 * can produce. Channel posts and other sender chats are rejected.
 */
export async function isChatAdmin(ctx: Context): Promise<boolean> {
  const chat = ctx.chat;
  if (!chat) return false;

  const senderChat = ctx.msg?.sender_chat;
  if (senderChat) return senderChat.id === chat.id;

  if (!ctx.from) return false;
  const member = await ctx.api.getChatMember(chat.id, ctx.from.id);
  return member.status === 'creator' || member.status === 'administrator';
}

export function isGroupChat(ctx: Context): boolean {
  return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
}
