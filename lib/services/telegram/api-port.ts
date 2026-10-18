/**
 * The only Telegram Bot API calls the services need. Services depend on this
 * port (not on grammY) so they stay unit-testable; lib/telegram/client.ts
 * adapts a grammY `Api` to it.
 */
export type TelegramApiPort = {
  getMe(): Promise<{ id: number }>;
  getChat(chatId: number): Promise<{ title?: string; isForum: boolean }>;
  getChatMember(
    chatId: number,
    userId: number,
  ): Promise<{ status: string; canManageTopics: boolean }>;
  createForumTopic(
    chatId: number,
    name: string,
  ): Promise<{ messageThreadId: number }>;
  sendMessage(
    chatId: number,
    text: string,
    messageThreadId?: number,
  ): Promise<void>;
};

/** Telegram group ids (-100xxxxxxxxxx) are well inside Number.MAX_SAFE_INTEGER. */
export function toApiChatId(chatId: bigint): number {
  return Number(chatId);
}

export function memberCanManageTopics(member: {
  status: string;
  canManageTopics: boolean;
}): boolean {
  return (
    member.status === 'creator' ||
    (member.status === 'administrator' && member.canManageTopics)
  );
}
