import 'server-only';
import type { Bot } from 'grammy';
import { revalidatePath } from 'next/cache';
import { createBot } from './bot';
import { requireBotToken } from './client';

const g = globalThis as unknown as { __tgBot?: Bot };

export function getBot(): Bot {
  return (g.__tgBot ??= createBot(requireBotToken(), {
    onMembershipActivated: () => {
      revalidatePath('/me');
      revalidatePath('/');
    },
  }));
}
