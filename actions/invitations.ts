'use server';

import { revalidatePath } from 'next/cache';

import { requireRole, requireSession } from '@/lib/auth/authorize';
import {
  buildInvitationLinks,
  captureTelegramInvitation,
  createInvitation,
  InvitationError,
  acceptInvitation,
} from '@/lib/services/invitations';
import { createInvitationSchema } from '@/lib/validations/invitation';

export type InvitationActionState = {
  ok: boolean;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
  data?: {
    webUrl: string;
    telegramUrl: string;
    telegramBotUrl: string;
    expiresAt: string;
  };
} | null;

export async function createInvitationAction(
  _previous: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const actor = await requireRole(['super_admin']);
  const readText = (name: string) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };
  const raw = {
    email: readText('email'),
    role: readText('role'),
    batchId: readText('batchId'),
    paceGroupId: readText('paceGroupId'),
    paceDuty: readText('paceDuty'),
  };
  const parsed = createInvitationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten() };
  }

  try {
    const invitation = await createInvitation(actor.profile.id, parsed.data);
    const links = buildInvitationLinks(invitation.token);
    revalidatePath('/admin/platform/invitations');
    return {
      ok: true,
      data: {
        ...links,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      errors: {
        formErrors: [
          error instanceof Error
            ? error.message
            : 'Could not create invitation.',
        ],
        fieldErrors: {},
      },
    };
  }
}

export type AcceptInvitationActionState = {
  ok: boolean;
  redirectTo?: string;
  error?: string;
} | null;

export async function acceptInvitationAction(
  _previous: AcceptInvitationActionState,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const currentUser = await requireSession();
  const token = formData.get('token');
  if (typeof token !== 'string') {
    return { ok: false, error: 'Invitation token is invalid.' };
  }

  try {
    const result = await acceptInvitation(token, currentUser.authUserId);
    revalidatePath('/admin');
    revalidatePath('/');
    const redirectTo =
      result.role === 'super_admin'
        ? '/admin/platform'
        : result.role === 'member'
          ? '/me'
          : '/admin';
    return { ok: true, redirectTo };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvitationError
          ? error.message
          : 'Could not accept this invitation.',
    };
  }
}

export async function captureTelegramInvitationAction(
  initData: string,
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  if (
    typeof initData !== 'string' ||
    initData.length < 1 ||
    initData.length > 8192
  ) {
    return { ok: false, error: 'Telegram invitation data is missing.' };
  }

  try {
    const token = await captureTelegramInvitation(initData);
    const links = buildInvitationLinks(token);
    return { ok: true, redirectTo: links.webUrl };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvitationError
          ? error.message
          : 'Telegram could not verify this invitation.',
    };
  }
}
