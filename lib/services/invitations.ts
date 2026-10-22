import 'server-only';

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { and, asc, desc, eq, gt, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import {
  batchAdmins,
  batchMemberships,
  batches,
  invitations,
  membershipAuditLogs,
  paceAdminAssignments,
  paceGroups,
  profiles,
  user,
} from '@/db/schema';
import type { CreateInvitationInput } from '@/lib/validations/invitation';
import { invitationTokenSchema } from '@/lib/validations/invitation';
import { NON_TERMINAL_STATUSES } from '@/lib/services/membership';

const INVITATION_TTL_DAYS = 7;
const TELEGRAM_AUTH_MAX_AGE_SECONDS = 600;
const INVITATION_LIST_LIMIT = 100;

export type InvitationErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'USED'
  | 'EMAIL_MISMATCH'
  | 'SCOPE_MISMATCH'
  | 'ALREADY_MEMBER'
  | 'TELEGRAM_UNAVAILABLE'
  | 'TELEGRAM_INVALID';

export class InvitationError extends Error {
  constructor(
    readonly code: InvitationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'InvitationError';
  }
}

export type InvitationRole =
  'member' | 'pace_admin' | 'batch_admin' | 'super_admin';

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createRawToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createInvitation(
  createdBy: string,
  input: CreateInvitationInput,
) {
  if (input.batchId) {
    const batch = await db.query.batches.findFirst({
      where: eq(batches.id, input.batchId),
    });
    if (!batch) {
      throw new InvitationError('SCOPE_MISMATCH', 'Selected batch not found.');
    }
  }

  if (input.role === 'pace_admin' && input.paceGroupId && input.batchId) {
    const group = await db.query.paceGroups.findFirst({
      where: eq(paceGroups.id, input.paceGroupId),
    });
    if (!group || group.batchId !== input.batchId) {
      throw new InvitationError(
        'SCOPE_MISMATCH',
        'The selected pace group does not belong to the selected batch.',
      );
    }
  }

  const token = createRawToken();
  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const [invitation] = await db
    .insert(invitations)
    .values({
      email: input.email,
      role: input.role,
      batchId: input.batchId,
      paceGroupId: input.paceGroupId,
      paceDuty: input.paceDuty,
      tokenHash: hashInvitationToken(token),
      expiresAt,
      createdBy,
    })
    .returning({ id: invitations.id, expiresAt: invitations.expiresAt });

  return { ...invitation, token };
}

export async function listInvitations() {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      batchId: invitations.batchId,
      paceGroupId: invitations.paceGroupId,
      paceDuty: invitations.paceDuty,
      expiresAt: invitations.expiresAt,
      usedAt: invitations.usedAt,
      createdAt: invitations.createdAt,
      batchName: batches.name,
      paceGroupName: paceGroups.name,
    })
    .from(invitations)
    .leftJoin(batches, eq(invitations.batchId, batches.id))
    .leftJoin(paceGroups, eq(invitations.paceGroupId, paceGroups.id))
    .orderBy(desc(invitations.createdAt))
    .limit(INVITATION_LIST_LIMIT);
}

export async function getInvitationOptions() {
  const [batchOptions, paceGroupOptions] = await Promise.all([
    db
      .select({ id: batches.id, name: batches.name })
      .from(batches)
      .orderBy(asc(batches.name))
      .limit(INVITATION_LIST_LIMIT),
    db
      .select({
        id: paceGroups.id,
        name: paceGroups.name,
        batchId: paceGroups.batchId,
      })
      .from(paceGroups)
      .where(eq(paceGroups.archived, false))
      .orderBy(asc(paceGroups.name))
      .limit(INVITATION_LIST_LIMIT),
  ]);

  return { batches: batchOptions, paceGroups: paceGroupOptions };
}

export async function getInvitationPreview(token: string, email?: string) {
  const parsedToken = invitationTokenSchema.safeParse(token);
  if (!parsedToken.success) return { status: 'invalid' as const };

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.tokenHash, hashInvitationToken(token)),
  });
  if (!invitation) return { status: 'invalid' as const };
  if (invitation.usedAt) return { status: 'used' as const };
  if (invitation.expiresAt <= new Date()) return { status: 'expired' as const };

  const emailMatches =
    !invitation.email ||
    email === undefined ||
    (email !== undefined &&
      invitation.email.toLowerCase() === email.trim().toLowerCase());

  return {
    status: emailMatches ? ('ready' as const) : ('email_mismatch' as const),
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptInvitation(token: string, authUserId: string) {
  const parsedToken = invitationTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    throw new InvitationError('INVALID_INPUT', 'Invitation token is invalid.');
  }

  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashInvitationToken(token)))
      .for('update');

    if (!invitation) {
      throw new InvitationError('NOT_FOUND', 'Invitation was not found.');
    }
    if (invitation.usedAt) {
      throw new InvitationError(
        'USED',
        'This invitation has already been used.',
      );
    }
    const now = new Date();
    if (invitation.expiresAt <= now) {
      throw new InvitationError('EXPIRED', 'This invitation has expired.');
    }

    const [account] = await tx
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, authUserId))
      .limit(1);
    if (!account) {
      throw new InvitationError('NOT_FOUND', 'Your account was not found.');
    }
    if (
      invitation.email &&
      invitation.email.toLowerCase() !== account.email.trim().toLowerCase()
    ) {
      throw new InvitationError(
        'EMAIL_MISMATCH',
        'Sign in with the email address this invitation was sent to.',
      );
    }

    let [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.authUserId, account.id))
      .for('update');

    if (!profile) {
      [profile] = await tx
        .insert(profiles)
        .values({ authUserId: account.id, role: 'member' })
        .returning();
    }

    if (profile.isSuperAdmin && invitation.role !== 'super_admin') {
      throw new InvitationError(
        'SCOPE_MISMATCH',
        'An invitation cannot change an existing super-admin account.',
      );
    }

    if (invitation.role === 'member' && invitation.batchId) {
      const existingMembership = await tx.query.batchMemberships.findFirst({
        where: and(
          eq(batchMemberships.profileId, profile.id),
          inArray(batchMemberships.status, [...NON_TERMINAL_STATUSES]),
        ),
      });
      if (existingMembership) {
        throw new InvitationError(
          'ALREADY_MEMBER',
          'This account already has an active or pending batch membership.',
        );
      }
    }

    if (
      invitation.role === 'pace_admin' &&
      invitation.paceGroupId &&
      invitation.batchId
    ) {
      const group = await tx.query.paceGroups.findFirst({
        where: and(
          eq(paceGroups.id, invitation.paceGroupId),
          eq(paceGroups.batchId, invitation.batchId),
        ),
      });
      if (!group || !invitation.paceDuty) {
        throw new InvitationError(
          'SCOPE_MISMATCH',
          'The invited pace-group assignment is no longer available.',
        );
      }
    }

    const [updatedProfile] = await tx
      .update(profiles)
      .set({
        role: invitation.role,
        isSuperAdmin: invitation.role === 'super_admin',
        ...(invitation.telegramUsername
          ? { telegramUsername: invitation.telegramUsername }
          : {}),
        updatedAt: now,
      })
      .where(eq(profiles.id, profile.id))
      .returning({ id: profiles.id });

    if (invitation.role === 'batch_admin' && invitation.batchId) {
      await tx
        .insert(batchAdmins)
        .values({ profileId: updatedProfile.id, batchId: invitation.batchId })
        .onConflictDoNothing();
    } else if (
      invitation.role === 'pace_admin' &&
      invitation.paceGroupId &&
      invitation.paceDuty
    ) {
      await tx
        .insert(paceAdminAssignments)
        .values({
          profileId: updatedProfile.id,
          paceGroupId: invitation.paceGroupId,
          duty: invitation.paceDuty,
          assignedBy: invitation.createdBy,
        })
        .onConflictDoNothing();
    } else if (invitation.role === 'member' && invitation.batchId) {
      await tx.insert(batchMemberships).values({
        profileId: updatedProfile.id,
        batchId: invitation.batchId,
        status: 'active',
      });

      await tx.insert(membershipAuditLogs).values({
        memberId: updatedProfile.id,
        fromState: 'applied',
        toState: 'active',
        fromBatchId: invitation.batchId,
        toBatchId: invitation.batchId,
        actorId: invitation.createdBy,
        reason: 'Membership created from invitation',
        timestamp: now,
      });
    }

    const [consumed] = await tx
      .update(invitations)
      .set({ usedAt: now, acceptedProfileId: updatedProfile.id })
      .where(
        and(
          eq(invitations.id, invitation.id),
          isNull(invitations.usedAt),
          gt(invitations.expiresAt, now),
        ),
      )
      .returning({ id: invitations.id });

    if (!consumed) {
      throw new InvitationError(
        'USED',
        'This invitation has already been used.',
      );
    }

    return { role: invitation.role, profileId: updatedProfile.id };
  });
}

type TelegramWebAppUser = {
  id: number;
  username?: string;
};

type TelegramStartData = {
  user: TelegramWebAppUser;
  startParam: string;
};

export function verifyTelegramWebAppData(
  initData: string,
  botToken = process.env.TELEGRAM_BOT_TOKEN,
): TelegramStartData | null {
  if (!botToken || initData.length > 8192) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    !receivedHash ||
    !Number.isInteger(authDate) ||
    authDate > nowSeconds + 60 ||
    nowSeconds - authDate > TELEGRAM_AUTH_MAX_AGE_SECONDS
  ) {
    return null;
  }

  const checkString = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const expectedHash = createHmac('sha256', secretKey)
    .update(checkString)
    .digest();
  const receivedHashBuffer = Buffer.from(receivedHash, 'hex');
  if (
    receivedHashBuffer.length !== expectedHash.length ||
    !timingSafeEqual(receivedHashBuffer, expectedHash)
  ) {
    return null;
  }

  try {
    const telegramUser = JSON.parse(
      params.get('user') ?? '',
    ) as TelegramWebAppUser;
    const startParam = params.get('start_param');
    if (
      !Number.isSafeInteger(telegramUser.id) ||
      !startParam?.startsWith('invite_')
    ) {
      return null;
    }
    return { user: telegramUser, startParam };
  } catch {
    return null;
  }
}

export async function recordTelegramInvitation(
  token: string,
  telegramUser: TelegramWebAppUser,
) {
  const parsedToken = invitationTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    throw new InvitationError('INVALID_INPUT', 'Invitation token is invalid.');
  }

  const now = new Date();
  const [updated] = await db
    .update(invitations)
    .set({
      telegramChatId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username ?? null,
    })
    .where(
      and(
        eq(invitations.tokenHash, hashInvitationToken(token)),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, now),
      ),
    )
    .returning({ id: invitations.id });

  if (!updated) {
    const preview = await getInvitationPreview(token);
    if (preview.status === 'expired') {
      throw new InvitationError('EXPIRED', 'This invitation has expired.');
    }
    if (preview.status === 'used') {
      throw new InvitationError(
        'USED',
        'This invitation has already been used.',
      );
    }
    throw new InvitationError('NOT_FOUND', 'Invitation was not found.');
  }
}

export async function captureTelegramInvitation(initData: string) {
  const telegramData = verifyTelegramWebAppData(initData);
  if (!telegramData) {
    throw new InvitationError(
      process.env.TELEGRAM_BOT_TOKEN
        ? 'TELEGRAM_INVALID'
        : 'TELEGRAM_UNAVAILABLE',
      'Telegram could not verify this invitation link.',
    );
  }

  const token = telegramData.startParam.slice('invite_'.length);
  await recordTelegramInvitation(token, telegramData.user);
  return token;
}

export function buildInvitationLinks(token: string) {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) {
    throw new InvitationError(
      'INVALID_INPUT',
      'BETTER_AUTH_URL must be configured to create invitation links.',
    );
  }

  const botUsername =
    process.env.TELEGRAM_BOT_USERNAME || 'emfsc_book_shelf_bot';
  const shortName = process.env.TELEGRAM_MINI_APP_SHORT_NAME;
  const startParam = encodeURIComponent(`invite_${token}`);
  return {
    webUrl: new URL(`/invitations/${token}`, baseUrl).toString(),
    telegramUrl: shortName
      ? `https://t.me/${botUsername}/${shortName}?startapp=${startParam}`
      : `https://t.me/${botUsername}?startapp=${startParam}`,
    telegramBotUrl: `https://t.me/${botUsername}?start=${encodeURIComponent(`invite_${token}`)}`,
  };
}

export function buildInvitationAcceptanceUrl(token: string) {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) {
    throw new InvitationError(
      'INVALID_INPUT',
      'BETTER_AUTH_URL must be configured to create invitation links.',
    );
  }
  return new URL(`/invitations/${token}`, baseUrl).toString();
}
