import { revalidatePath } from 'next/cache';
import { webhookCallback } from 'grammy';
import { createBot } from '@/lib/telegram/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Handler = (request: Request) => Promise<Response>;
let handler: Handler | null = null;

function getHandler(token: string, secretToken: string): Handler {
  if (!handler) {
    const bot = createBot(token, {
      onMembershipActivated: () => {
        revalidatePath('/me');
        revalidatePath('/');
      },
    });
    // grammY verifies the X-Telegram-Bot-Api-Secret-Token header and answers 401 itself.
    handler = webhookCallback(bot, 'std/http', { secretToken });
  }
  return handler;
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  // Fail closed: never accept updates without a configured secret.
  if (!token || !secretToken) {
    return new Response('Bot service unconfigured', { status: 500 });
  }
  return getHandler(token, secretToken)(request);
}
