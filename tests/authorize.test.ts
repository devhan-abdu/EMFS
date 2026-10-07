import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requireRole,
  requireSuperAdmin,
  AuthzError,
  authzErrorToFieldError,
  type Role,
} from '../lib/auth/authorize';
import * as sessionModule from '../lib/auth/session';
// import { db } from '@/db';

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({
  db: {
    query: {
      batchMemberships: { findFirst: vi.fn() },
    },
  },
}));
vi.mock('../lib/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));

describe('requireRole & requireSuperAdmin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws UNAUTHENTICATED when no user is signed in', async () => {
    vi.mocked(sessionModule.getCurrentUser).mockResolvedValue(null);

    await expect(requireSuperAdmin()).rejects.toThrowError(AuthzError);
    await expect(requireSuperAdmin()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'You must be signed in.',
    });
  });

  it.each<[Role, boolean]>([
    ['member', false],
    ['pace_admin', false],
    ['batch_admin', false],
    ['super_admin', true],
  ])(
    "role '%s' permitted for requireSuperAdmin: %s",
    async (role, shouldPass) => {
      vi.mocked(sessionModule.getCurrentUser).mockResolvedValue({
        authUserId: 'auth-123',
        email: 'user@example.com',
        profile: {
          id: 'prof-123',
          authUserId: 'auth-123',
          role: role,
          isSuperAdmin: role === 'super_admin',
          firstName: 'Test',
          fatherName: 'User',
          grandfatherName: null,
          telegramUsername: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (shouldPass) {
        const user = await requireSuperAdmin();
        expect(user.profile.role).toBe(role);
      } else {
        await expect(requireSuperAdmin()).rejects.toMatchObject({
          code: 'FORBIDDEN',
        });
      }
    },
  );

  it('formats AuthzError into FieldError correctly via authzErrorToFieldError', () => {
    const error = new AuthzError(
      'FORBIDDEN',
      "Role 'member' is not permitted.",
    );
    const fieldError = authzErrorToFieldError(error);

    expect(fieldError).toEqual({
      field: 'auth',
      code: 'FORBIDDEN',
      message: "Role 'member' is not permitted.",
    });
  });

  it('uses the explicit super-admin flag instead of the legacy profile role', async () => {
    vi.mocked(sessionModule.getCurrentUser).mockResolvedValue({
      authUserId: 'auth-123',
      email: 'user@example.com',
      profile: {
        id: 'prof-123',
        authUserId: 'auth-123',
        role: 'member',
        isSuperAdmin: true,
        firstName: 'Test',
        fatherName: 'User',
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await expect(requireSuperAdmin()).resolves.toMatchObject({
      profile: { role: 'member', isSuperAdmin: true },
    });
  });

  it('grants member access from membership, without implying it from admin grants', async () => {
    vi.mocked(sessionModule.getCurrentUser).mockResolvedValue({
      authUserId: 'auth-123',
      email: 'user@example.com',
      profile: {
        id: 'prof-123',
        authUserId: 'auth-123',
        role: 'super_admin',
        isSuperAdmin: true,
        firstName: 'Test',
        fatherName: 'User',
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(null);

    await expect(requireRole(['member'])).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    vi.mocked(sessionModule.getCurrentUser).mockResolvedValue({
      authUserId: 'auth-456',
      email: 'member@example.com',
      profile: {
        id: 'prof-456',
        authUserId: 'auth-456',
        role: 'member',
        isSuperAdmin: false,
        firstName: 'Member',
        fatherName: 'User',
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue({
      id: 'membership-123',
    } as never);

    await expect(requireRole(['member'])).resolves.toMatchObject({
      profile: { role: 'member', isSuperAdmin: false },
    });
  });
});
