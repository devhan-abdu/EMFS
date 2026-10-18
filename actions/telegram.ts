'use server';

import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';
import { getTelegramApiPort } from '@/lib/telegram/client';
import { disconnect, syncChatInfo } from '@/lib/services/telegram/connection';
import { createLinkCode } from '@/lib/services/telegram/link-codes';
import {
  createMissingPaceTopics,
  sendTestMessage,
} from '@/lib/services/telegram/topics';
import { TelegramConnectionError } from '@/lib/services/telegram/errors';
import { batchActionSchema } from '@/lib/validations/telegram';

export type TelegramActionState = {
  ok: boolean;
  message?: string;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
} | null;

const fail = (message: string): TelegramActionState => ({
  ok: false,
  errors: { formErrors: [message], fieldErrors: {} },
});

/**
 * Shared guard for every Telegram admin action: validates the batch id, enforces
 * batch-scoped authorization (super admin or admin of THIS batch) BEFORE doing
 * any work, then maps known errors to form errors. Unknown errors are not leaked.
 */
async function runBatchAction(
  formData: FormData,
  work: (ctx: { batchId: string; actorProfileId: string }) => Promise<string>,
): Promise<TelegramActionState> {
  const parsed = batchActionSchema.safeParse({
    batchId: formData.get('batchId'),
  });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

  const { batchId } = parsed.data;
  try {
    const user = await requireBatchAccess(batchId);
    const message = await work({ batchId, actorProfileId: user.profile.id });
    revalidatePath(`/admin/b/${batchId}/telegram`);
    return { ok: true, message };
  } catch (error) {
    if (
      error instanceof AuthzError ||
      error instanceof TelegramConnectionError
    ) {
      return fail(error.message);
    }
    console.error('telegram action failed:', error);
    return fail('An unexpected error occurred.');
  }
}

export async function generateTelegramLinkCodeAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  return runBatchAction(formData, async ({ batchId, actorProfileId }) => {
    await createLinkCode(db, batchId, actorProfileId);
    return 'New link code generated. It is valid for 15 minutes.';
  });
}

export async function createTelegramTopicsAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  let partialFailure: string | null = null;

  const result = await runBatchAction(formData, async ({ batchId }) => {
    const outcome = await createMissingPaceTopics(
      db,
      getTelegramApiPort(),
      batchId,
    );
    if (outcome.failed) {
      partialFailure = `Stopped at "${outcome.failed.name}": ${outcome.failed.reason}. ${outcome.created.length} topic(s) were created before that.`;
      return partialFailure;
    }
    return outcome.created.length
      ? `Created ${outcome.created.length} topic(s): ${outcome.created.join(', ')}.`
      : 'Every pace group already has a topic.';
  });

  // Topics made before the failure are saved; surface the failure as an error.
  return partialFailure ? fail(partialFailure) : result;
}

export async function syncTelegramChatAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  return runBatchAction(formData, async ({ batchId }) => {
    await syncChatInfo(db, getTelegramApiPort(), batchId);
    return 'Group information refreshed from Telegram.';
  });
}

export async function sendTelegramTestMessageAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  return runBatchAction(formData, async ({ batchId }) => {
    await sendTestMessage(db, getTelegramApiPort(), batchId);
    return 'Test message sent to the group.';
  });
}

export async function disconnectTelegramAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  return runBatchAction(formData, async ({ batchId }) => {
    const removed = await disconnect(db, batchId);
    return removed
      ? 'Telegram group disconnected. The bot is still in the group until you remove it there.'
      : 'This batch had no Telegram group.';
  });
}
