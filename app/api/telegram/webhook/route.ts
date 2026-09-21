// app/api/webhook/route.ts
import { revalidatePath } from 'next/cache';
import bot, { botEventEmitter } from '@/lib/services/bot';

export async function POST(req: Request) {
  if (!bot) {
    return new Response('Bot service unconfigured', { status: 500 });
  }

  try {
    const telegramHeaderToken = req.headers.get(
      'x-telegram-bot-api-secret-token',
    );
    const localSecretToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;

    if (!localSecretToken || telegramHeaderToken !== localSecretToken) {
      console.warn('Unauthorized webhook access attempt dropped.');
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await req.json();

    let shouldRevalidate = false;
    const handleActivationEvent = () => {
      shouldRevalidate = true;
    };
    botEventEmitter.once('activated', handleActivationEvent);

    await bot.handleUpdate(update);

    botEventEmitter.off('activated', handleActivationEvent);

    if (shouldRevalidate) {
      revalidatePath('/me');
      revalidatePath('/');
      console.log('🛡️ Webhook: Securely revalidated routing paths.');
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('❌ Secure Webhook Pipeline Failure:', error);

    return new Response('Handled Webhook Error', { status: 200 });
  }
}
