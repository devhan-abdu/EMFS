import type { Bot, Context } from 'grammy';
import { db } from '@/db';
import { recordObservedTopic } from '@/lib/services/telegram/observed-topics';

/**
 * The Bot API cannot list a group's topics, so the bot remembers the names it
 * sees: a topic being created, a topic being renamed, and the topic root that
 * Telegram attaches to ordinary messages posted inside a topic.
 */
async function observe(ctx: Context) {
  const msg = ctx.message;
  const chat = ctx.chat;
  if (!msg || !chat) return;
  if (chat.type !== 'supergroup' && chat.type !== 'group') return;

  const threadId = msg.message_thread_id;
  if (threadId === undefined) return;

  let name: string | undefined;
  let source: 'created' | 'edited' | 'reply' | undefined;

  if (msg.forum_topic_created) {
    name = msg.forum_topic_created.name;
    source = 'created';
  } else if (msg.forum_topic_edited?.name) {
    name = msg.forum_topic_edited.name;
    source = 'edited';
  } else if (msg.is_topic_message) {
    name = msg.reply_to_message?.forum_topic_created?.name;
    source = 'reply';
  }

  if (!name || !source) return;
  await recordObservedTopic(db, {
    chatId: BigInt(chat.id),
    messageThreadId: threadId,
    name,
    source,
  });
}

/** Must be registered before the command handlers. Never blocks them. */
export function registerTopicObserver(bot: Bot) {
  bot.use(async (ctx, next) => {
    try {
      await observe(ctx);
    } catch (error) {
      console.error('telegram topic observer failed:', error);
    }
    await next();
  });
}
