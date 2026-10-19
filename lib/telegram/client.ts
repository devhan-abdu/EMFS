import 'server-only';
import { Api } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import type { TelegramApiPort } from '@/lib/services/telegram/api-port';

export function requireBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  return token;
}

/**
 * System-side Telegram client (posting, creating topics) that works without
 * the bot process running. Retries on 429 / transient errors.
 */
export function createTelegramApi(token: string = requireBotToken()): Api {
  const api = new Api(token);
  api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 10 }));
  return api;
}

/** Adapts a grammY `Api` to the narrow port the services depend on. */
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
  };
}

export function getTelegramApiPort(): TelegramApiPort {
  return toApiPort(createTelegramApi());
}
