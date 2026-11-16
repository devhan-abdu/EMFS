import { Bot } from 'grammy';
import type { Update } from 'grammy/types';
import { autoRetry } from '@grammyjs/auto-retry';
import { registerChatEventHandlers } from './handlers/chat-events';
import { registerStartHandler } from './handlers/start';
import { registerTopicHandler } from './handlers/register-topic';

export type BotDeps = {
  /** Called after a membership was activated (webhook uses it to revalidate pages). */
  onMembershipActivated?: () => void;
};

/**
 * Builds the bot. Pure construction, no side effects at import time, so it is
 * safe to import from Next.js route files and from the polling script alike.
 */
export function createBot(token: string, deps: BotDeps = {}): Bot {
  const bot = new Bot(token);
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 10 }));

  bot.use(async (ctx, next) => {
    console.log('[tg]', ctx.update.update_id, Object.keys(ctx.update), {
      text: ctx.message?.text,
      newMembers: ctx.message?.new_chat_members?.map((m) => m.username),
    });
    await next();
  });
  registerStartHandler(bot, deps.onMembershipActivated ?? (() => {}));
  registerChatEventHandlers(bot);
  registerTopicHandler(bot);

  bot.catch((err) => {
    console.error(
      `Telegram update ${err.ctx.update.update_id} failed:`,
      err.error,
    );
  });

  return bot;
}
