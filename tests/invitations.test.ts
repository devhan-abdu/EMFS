import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: {
    invitations: { findFirst: vi.fn() },
  },
  update: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: mocks }));

import {
  acceptInvitation,
  buildInvitationLinks,
  captureTelegramInvitation,
  getInvitationPreview,
  hashInvitationToken,
  verifyTelegramWebAppData,
} from '@/lib/services/invitations';

const token = 'A'.repeat(43);
const tokenHash = hashInvitationToken(token);
const now = new Date();
const invitation = {
  id: 'invitation-1',
  email: 'reader@example.com',
  role: 'super_admin' as const,
  batchId: null,
  paceGroupId: null,
  paceDuty: null,
  tokenHash,
  expiresAt: new Date(Date.now() + 60_000),
  usedAt: null,
  createdBy: 'creator-profile',
  acceptedProfileId: null,
  telegramChatId: null,
  telegramUsername: null,
  createdAt: now,
};

function selectBuilder(result: unknown[]) {
  const builder: {
    from: () => typeof builder;
    where: () => typeof builder;
    for: () => typeof builder;
    limit: () => typeof builder;
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    from: () => builder,
    where: () => builder,
    for: () => builder,
    limit: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function updateBuilder(result: unknown[]) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { set, where, returning };
}

function makeTelegramInitData(startParam: string, botToken: string) {
  const values = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'query-1',
    start_param: startParam,
    user: JSON.stringify({ id: 123456789, username: 'reader' }),
  };
  const checkString = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const hash = createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');
  return new URLSearchParams({ ...values, hash }).toString();
}

function setupAcceptMocks(invite = invitation) {
  const profile = {
    id: 'profile-1',
    authUserId: 'auth-user-1',
    role: 'member',
    isSuperAdmin: false,
  };
  const values = [
    [invite],
    [{ id: 'auth-user-1', email: 'reader@example.com' }],
    [profile],
  ];
  const tx = {
    select: vi.fn(() => selectBuilder(values.shift() ?? [])),
    update: vi
      .fn()
      .mockReturnValueOnce(updateBuilder([{ id: profile.id }]))
      .mockReturnValueOnce(updateBuilder([{ id: invite.id }])),
    insert: vi.fn(),
    query: {
      batchMemberships: { findFirst: vi.fn() },
      paceGroups: { findFirst: vi.fn() },
    },
  };
  mocks.transaction.mockImplementation(
    async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
  );
  return tx;
}

describe('invitation web flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.BETTER_AUTH_URL = 'https://emfs.example';
  });

  it('previews an unexpired invitation and generates web and Telegram links', async () => {
    mocks.query.invitations.findFirst.mockResolvedValue(invitation);

    await expect(getInvitationPreview(token)).resolves.toMatchObject({
      status: 'ready',
      email: 'reader@example.com',
      role: 'super_admin',
    });
    expect(buildInvitationLinks(token)).toEqual({
      webUrl: `https://emfs.example/invitations/${token}`,
      telegramUrl: `https://t.me/emfsc_book_shelf_bot?startapp=invite_${token}`,
      telegramBotUrl: `https://t.me/emfsc_book_shelf_bot?start=invite_${token}`,
    });
  });

  it('accepts a valid web invitation for the invited signed-in account', async () => {
    setupAcceptMocks();

    await expect(acceptInvitation(token, 'auth-user-1')).resolves.toEqual({
      role: 'super_admin',
      profileId: 'profile-1',
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it('rejects an expired invitation', async () => {
    setupAcceptMocks({
      ...invitation,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(acceptInvitation(token, 'auth-user-1')).rejects.toMatchObject({
      code: 'EXPIRED',
    });
  });

  it('rejects an already-used invitation', async () => {
    setupAcceptMocks({ ...invitation, usedAt: new Date() });

    await expect(acceptInvitation(token, 'auth-user-1')).rejects.toMatchObject({
      code: 'USED',
    });
  });

  it('rejects acceptance when the signed-in email differs from the invitation', async () => {
    const invite = { ...invitation, email: 'other@example.com' };
    const tx = setupAcceptMocks(invite);
    tx.select = vi
      .fn()
      .mockReturnValueOnce(selectBuilder([invite]))
      .mockReturnValueOnce(
        selectBuilder([{ id: 'auth-user-1', email: 'reader@example.com' }]),
      );

    await expect(acceptInvitation(token, 'auth-user-1')).rejects.toMatchObject({
      code: 'EMAIL_MISMATCH',
    });
  });
});

describe('Telegram invitation flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
  });

  it('verifies Telegram-signed Mini App data and records the Telegram identity', async () => {
    const initData = makeTelegramInitData(`invite_${token}`, 'test-bot-token');
    const update = updateBuilder([{ id: invitation.id }]);
    mocks.update.mockReturnValue(update);

    expect(verifyTelegramWebAppData(initData, 'test-bot-token')).toMatchObject({
      user: { id: 123456789, username: 'reader' },
      startParam: `invite_${token}`,
    });
    await expect(captureTelegramInvitation(initData)).resolves.toBe(token);
    expect(update.set).toHaveBeenCalledWith({
      telegramChatId: 123456789n,
      telegramUsername: 'reader',
    });
  });

  it('rejects modified or stale Telegram-signed data', () => {
    const valid = makeTelegramInitData(`invite_${token}`, 'test-bot-token');
    expect(
      verifyTelegramWebAppData(`${valid}&user=forged`, 'test-bot-token'),
    ).toBeNull();

    const staleValues = {
      auth_date: String(Math.floor(Date.now() / 1000) - 601),
      start_param: `invite_${token}`,
      user: JSON.stringify({ id: 123456789 }),
    };
    const stale = makeTelegramInitData(`invite_${token}`, 'test-bot-token');
    const staleParams = new URLSearchParams(stale);
    staleParams.set('auth_date', staleValues.auth_date);
    expect(
      verifyTelegramWebAppData(staleParams.toString(), 'test-bot-token'),
    ).toBeNull();
  });
});
