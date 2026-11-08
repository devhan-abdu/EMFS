import { getBot } from '@/lib/telegram/bot-instance';
import { isTransientError, isBadTokenError } from '@/lib/telegram/errors';
import { BotError, webhookCallback } from 'grammy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const g = globalThis as unknown as {
  __tgWebhookHandler?: (request: Request) => Promise<Response>;
};

function describe(error: unknown) {
  const inner = error instanceof BotError ? error.error : error;
  return {
    updateId:
      error instanceof BotError ? error.ctx.update.update_id : undefined,
    name: inner instanceof Error ? inner.name : typeof inner,
    message: inner instanceof Error ? inner.message : String(inner),
  };
}

export async function POST(request: Request) {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;

  if (!secretToken) {
    console.error('TELEGRAM_WEBHOOK_SECRET_TOKEN is missing');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  try {
    const handler = (g.__tgWebhookHandler ??= webhookCallback(
      getBot(),
      'std/http',
      { secretToken },
    ));

    return await handler(request);
  } catch (error) {
    if (isTransientError(error)) {
      console.error(
        '[webhook] transient failure, Telegram will retry',
        describe(error),
      );
      return new Response('retry', { status: 500 });
    }
    if (isBadTokenError(error)) {
      console.error(
        '[webhook] BOT TOKEN REJECTED (401). Fix env and redeploy.',
        describe(error),
      );
      return new Response('misconfigured', { status: 500 });
    }

    console.error(
      '[webhook] permanent failure, dropping update',
      describe(error),
    );
    return new Response('ok', { status: 200 });
  }
}
