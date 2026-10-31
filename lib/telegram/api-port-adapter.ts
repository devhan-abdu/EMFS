import 'server-only';
import { Api } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import type { TelegramApiPort } from '@/lib/services/telegram/api-port';


export function toApiPort(api: Api): TelegramApiPort {
  return {
    async getMe() {
      const me = await api.getMe();
      return { id: me.id };
    },
    async getChat(chatId) {
      const chat = await api.getChat(chatId);
      return {
        title: 'title' in chat ? chat.title : undefined,
        isForum: chat.is_forum === true,
      };
    },
    async getChatMember(chatId, userId) {
      const member = await api.getChatMember(chatId, userId);
      return {
        status: member.status,
        canManageTopics:
          'can_manage_topics' in member && member.can_manage_topics === true,
      };
    },
    async createForumTopic(chatId, name) {
      const topic = await api.createForumTopic(chatId, name);
      return { messageThreadId: topic.message_thread_id };
    },
    async editForumTopic(chatId, messageThreadId, name) {
      await api.editForumTopic(chatId, messageThreadId, { name });
    },
    async sendMessage(chatId, text, messageThreadId) {
      await api.sendMessage(
        chatId,
        text,
        messageThreadId === undefined
          ? undefined
          : { message_thread_id: messageThreadId },
      );
    },
    async setChatTitle(chatId, title) {
      await api.setChatTitle(chatId, title);
    },
  };
}
