import { Bot } from 'grammy';
import type { Update } from 'grammy/types';
import { autoRetry } from '@grammyjs/auto-retry';
import { registerChatEventHandlers } from './handlers/chat-events';
import { registerLinkHandler } from './handlers/link';
import { registerStartHandler } from './handlers/start';
import { registerTopicObserver } from './handlers/topic-observer';
import { registerTopicHandler } from './handlers/topic';

/** Only subscribe to what we handle; Telegram sends nothing else. */
export const ALLOWED_UPDATES: ReadonlyArray<
  Exclude<keyof Update, 'update_id'>
> = ['message', 'my_chat_member'];

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

  // First, so topic names are recorded before any command runs.
  registerTopicObserver(bot);
  registerStartHandler(bot, deps.onMembershipActivated ?? (() => {}));
  registerLinkHandler(bot);
  registerTopicHandler(bot);
  registerChatEventHandlers(bot);

  bot.catch((err) => {
    console.error(
      `Telegram update ${err.ctx.update.update_id} failed:`,
      err.error,
    );
  });

  return bot;
}
