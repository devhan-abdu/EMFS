import { ALLOWED_UPDATES, createBot } from '@/lib/telegram/bot';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set.');
  process.exit(1);
}

const bot = createBot(token);

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

// Local development only. Production uses the webhook route.
void bot.start({
  allowed_updates: ALLOWED_UPDATES,
  onStart: (me) => console.log(`🤖 @${me.username} is polling for updates...`),
});
