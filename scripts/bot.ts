import bot from '@/lib/services/bot';

if (!bot) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set.');
  process.exit(1);
}

bot.start({
  onStart: () => {
    console.log('🤖 Bot is polling for updates...');
  },
});

process.once('SIGINT', () => bot?.stop());
process.once('SIGTERM', () => bot?.stop());
