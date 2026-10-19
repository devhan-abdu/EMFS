import { eq, sql } from 'drizzle-orm';
import { telegramChats, telegramObservedTopics } from '@/db/schema';
import type { TelegramTopicNameSource } from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import {
  groupChatIdSchema,
  threadIdSchema,
  topicNameSchema,
} from '@/lib/validations/telegram';

/** A rename the bot saw beats a creation message, which beats a reply's topic root. */
const SOURCE_PRIORITY: Record<TelegramTopicNameSource, number> = {
  reply: 1,
  created: 2,
  edited: 3,
};

/**
 * Stores a topic name for a chat the caller already holds. A lower-quality
 * observation never overwrites a better one.
 */
export async function upsertObservedTopic(
  executor: DbOrTx,
  input: {
    telegramChatId: string;
    messageThreadId: number;
    name: string;
    source: TelegramTopicNameSource;
  },
): Promise<void> {
  const threadId = threadIdSchema.parse(input.messageThreadId);
  const name = topicNameSchema.parse(input.name);

  await executor
    .insert(telegramObservedTopics)
    .values({
      telegramChatId: input.telegramChatId,
      messageThreadId: threadId,
      name,
      nameSource: input.source,
    })
    .onConflictDoUpdate({
      target: [
        telegramObservedTopics.telegramChatId,
        telegramObservedTopics.messageThreadId,
      ],
      set: { name, nameSource: input.source, lastSeenAt: new Date() },
      setWhere: sql`(case ${telegramObservedTopics.nameSource} when 'edited' then 3 when 'created' then 2 else 1 end) <= ${SOURCE_PRIORITY[input.source]}`,
    });
}

/**
 * Remembers a topic's name as read from Telegram (the Bot API cannot list topics).
 * Ignored for groups that are not linked. Returns true when a name was stored.
 */
export async function recordObservedTopic(
  executor: DbOrTx,
  input: {
    chatId: bigint;
    messageThreadId: number;
    name: string;
    source: TelegramTopicNameSource;
  },
): Promise<boolean> {
  groupChatIdSchema.parse(input.chatId);

  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.chatId, input.chatId),
    columns: { id: true },
  });
  if (!chat) return false;

  await upsertObservedTopic(executor, {
    telegramChatId: chat.id,
    messageThreadId: input.messageThreadId,
    name: input.name,
    source: input.source,
  });
  return true;
}
