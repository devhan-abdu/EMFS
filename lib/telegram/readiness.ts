// lib/services/telegram/readiness.ts
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { batches, batchAdmins, paceGroups, telegramChats } from '@/db/schema';

export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  hint?: string;
};
/// why not we make promise all 

export async function getTelegramReadiness(batchId: string) {
  const [batch] = await db
    .select()
    .from(batches)
    .where(eq(batches.id, batchId));
  if (!batch) return null;

  const [{ admins }] = await db
    .select({ admins: count() })
    .from(batchAdmins)
    .where(eq(batchAdmins.batchId, batchId));
  const [{ groups }] = await db
    .select({ groups: count() })
    .from(paceGroups)
    .where(
      and(eq(paceGroups.batchId, batchId), eq(paceGroups.archived, false)),
    );
  const [chat] = await db
    .select()
    .from(telegramChats)
    .where(eq(telegramChats.batchId, batchId));

  // Blocking: the button stays disabled until all pass
  const system: ReadinessItem[] = [
    {
      key: 'bot',
      label: 'Telegram bot is configured',
      ok: Boolean(
        process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_BOT_TOKEN,
      ),
      hint: 'Set TELEGRAM_BOT_USERNAME and TELEGRAM_BOT_TOKEN.',
    },
    {
      key: 'admin',
      label: 'At least one batch admin assigned',
      ok: admins >= 1,
      hint: 'Assign a batch admin first.',
    },
    {
      key: 'pace',
      label: 'At least one pace group created',
      ok: groups >= 1,
      hint: 'Create a pace group first.',
    },
  ];

  // Informational: verified for real only after the bot has joined
  const telegram: ReadinessItem[] = [
    {
      key: 'group',
      label: `Telegram group created and named "${batch.name}"`,
      ok: Boolean(chat), // after linking
      hint: 'Create it in Telegram, using the batch name as the group name.',
    },
    {
      key: 'topics',
      label: 'Topics enabled in the group',
      ok: Boolean(chat?.isForum),
      hint: 'Group settings → Topics → enable.',
    },
    {
      key: 'perm',
      label: 'Bot can manage topics',
      ok: Boolean(chat?.canManageTopics),
    },
  ];

  return {
    batch,
    linked: Boolean(chat),
    system,
    telegram,
    canConnect: system.every((i) => i.ok),
  };
}
