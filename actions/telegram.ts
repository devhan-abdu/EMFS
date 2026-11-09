'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import {
  AuthzError,
  requireBatchAccess,
  requireRole,
} from '@/lib/auth/authorize';
import { getTelegramApiPort } from '@/lib/telegram/client';
import { buildAddToGroupLink } from '@/lib/telegram/add-to-group';
import { disconnect, syncChatInfo } from '@/lib/services/telegram/connection';
import { createLinkCode } from '@/lib/services/telegram/link-codes';
import {
  createPaceGroupForDiscoveredTopic,
  mapDiscoveredTopic,
  TelegramTopicDiscoveryError,
} from '@/lib/services/telegram/topic-discovery';
import { PaceGroupError } from '@/lib/services/pace-groups/pace-group';
import { getConnectBlocker } from '@/lib/telegram/readiness';
import { TelegramConnectionError } from '@/lib/services/telegram/errors';
import {
  createLinkCodeActionSchema,
  createPaceGroupForDiscoveredTopicActionSchema,
  mapDiscoveredTopicActionSchema,
} from '@/lib/validations/telegram';
import { getTelegramConfig } from '@/lib/config/telegram';

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

async function runBatchAction(
  formData: FormData,
  work: (ctx: { batchId: string; actorProfileId: string }) => Promise<string>,
): Promise<TelegramActionState> {
  const parsed = createLinkCodeActionSchema.safeParse({
    batchId: formData.get('batchId'),
    topicSyncMode: formData.get('topicSyncMode') ?? undefined,
  });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

  const { batchId } = parsed.data;
  try {
    const user = await requireBatchAccess(batchId);
    const message = await work({ batchId, actorProfileId: user.profile.id });
    revalidatePath(`/admin/batches/${batchId}`);
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

export async function connectTelegramAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  const parsed = createLinkCodeActionSchema.safeParse({
    batchId: formData.get('batchId'),
  });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

  let url: string;

  try {
    const user = await requireBatchAccess(parsed.data.batchId);

    const config = getTelegramConfig();
    if (!config) {
      console.error('[telegram] bot is not configured');
      return fail(
        'Telegram is temporarily unavailable. Please contact support.',
      );
    }

    const blocker = await getConnectBlocker(db, parsed.data.batchId);
    if (blocker) return fail(blocker);

    const linkCode = await createLinkCode(
      db,
      parsed.data.batchId,
      user.profile.id,
    );
    url = buildAddToGroupLink(config.username, linkCode.code);
  } catch (error) {
    if (
      error instanceof AuthzError ||
      error instanceof TelegramConnectionError
    ) {
      return fail(error.message);
    }
    console.error('telegram connect failed:', error);
    return fail('Could not create the link.');
  }

  redirect(url);
}

export async function refreshTelegramAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  return runBatchAction(formData, async ({ batchId }) => {
    await syncChatInfo(db, getTelegramApiPort(), batchId);
    return 'Group information refreshed from Telegram.';
  });
}

export async function disconnectTelegramAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  return runBatchAction(formData, async ({ batchId }) => {
    const removed = await disconnect(db, getTelegramApiPort(), batchId);

    return removed
      ? 'Telegram group disconnected. The bot has left the group.'
      : 'This batch had no Telegram group.';
  });
}

export async function mapDiscoveredTopicAction(
  _prev: TelegramActionState,
  formData: FormData,
): Promise<TelegramActionState> {
  const parsed = mapDiscoveredTopicActionSchema.safeParse({
    batchId: formData.get('batchId'),
    discoveryId: formData.get('discoveryId'),
    paceGroupId: formData.get('paceGroupId'),
  });

  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten() };
  }

  try {
    await requireBatchAccess(parsed.data.batchId);
    const result = await mapDiscoveredTopic(db, parsed.data);
    revalidatePath(`/admin/b/${parsed.data.batchId}/telegram`);
    return { ok: true, message: result.message };
  } catch (error) {
    if (
      error instanceof AuthzError ||
      error instanceof TelegramTopicDiscoveryError
    ) {
      return fail(error.message);
    }

    console.error('telegram topic mapping failed:', error);
    return fail('Could not map this Telegram topic.');
  }
}

export async function createPaceGroupForDiscoveredTopicAction(input: unknown) {
  try {
    await requireRole(['batch_admin', 'super_admin']);
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [error.message], fieldErrors: {} },
      };
    }
    throw error;
  }

  const parsed = createPaceGroupForDiscoveredTopicActionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    await requireBatchAccess(parsed.data.batchId);
    const result = await createPaceGroupForDiscoveredTopic(db, parsed.data);
    revalidatePath(`/admin/b/${parsed.data.batchId}/telegram`);
    revalidatePath(`/admin/b/${parsed.data.batchId}`);
    revalidatePath('/admin/pace-groups');
    return { ok: true as const, data: result };
  } catch (error) {
    if (
      error instanceof AuthzError ||
      error instanceof TelegramTopicDiscoveryError ||
      error instanceof PaceGroupError
    ) {
      return {
        ok: false as const,
        errors: { formErrors: [error.message], fieldErrors: {} },
      };
    }

    console.error('telegram pace group creation failed:', error);
    return {
      ok: false as const,
      errors: {
        formErrors: ['Could not create and connect this pace group.'],
        fieldErrors: {},
      },
    };
  }
}
