import { Api } from 'grammy';
import { ALLOWED_UPDATES } from '@/lib/telegram/bot';

/**
 * Usage:
 *   pnpm bot:webhook https://your-domain.com/api/telegram/webhook
 *   pnpm bot:webhook --delete        (switch back to polling for local dev)
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
const arg = process.argv[2];

if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set.');

const api = new Api(token);

async function main() {
  if (arg === '--delete') {
    await api.deleteWebhook();
    console.log('Webhook removed.');
    return;
  }
  if (!arg || !arg.startsWith('https://')) {
    throw new Error('Pass the public HTTPS webhook URL as the first argument.');
  }
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET_TOKEN is not set.');

  await api.setWebhook(arg, {
    secret_token: secret,
    allowed_updates: [...ALLOWED_UPDATES],
  });
  const info = await api.getWebhookInfo();
  console.log('Webhook set:', {
    url: info.url,
    pending: info.pending_update_count,
    lastError: info.last_error_message ?? null,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
