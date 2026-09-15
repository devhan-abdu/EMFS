import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Bypass Next.js server-only restriction
vi.mock('server-only', () => ({}));

// 2. Mock database
vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// 3. Mock Next.js cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// 4. Mock session user
vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@example.com' },
    session: { id: 'session-1' },
  }),
}));

// 5. Shared AuthzError class definition
const { AuthzErrorClass, mockRequireBatchAccess } = vi.hoisted(() => {
  class AuthzError extends Error {
    code: string;
    constructor(message: string, code = 'FORBIDDEN') {
      super(message);
      this.name = 'AuthzError';
      this.code = code;
    }
  }

  return {
    AuthzErrorClass: AuthzError,
    mockRequireBatchAccess: vi.fn(),
  };
});

// 6. Mock authorize module
vi.mock('@/lib/auth/authorize', () => ({
  AuthzError: AuthzErrorClass,
  requireBatchAccess: (...args: unknown[]) => mockRequireBatchAccess(...args),
}));

// 7. Mock service layer dependencies
const serviceMocks = {
  getPaceGroupById: vi.fn(),
  assignPaceAdmin: vi.fn(),
};

vi.mock('@/lib/services/pace-groups/pace-group', () => ({
  getPaceGroupById: (...args: unknown[]) =>
    serviceMocks.getPaceGroupById(...args),
}));

vi.mock('@/lib/services/pace-groups/pace-admin-assignment', () => ({
  assignPaceAdmin: (...args: unknown[]) =>
    serviceMocks.assignPaceAdmin(...args),
  PaceAdminError: class PaceAdminError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { assignPaceAdminAction } from '@/actions/pace-admin';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assignPaceAdminAction Boundary', () => {
  it('fails schema validation on invalid inputs', async () => {
    const result = await assignPaceAdminAction({
      profileId: 'not-a-uuid',
      paceGroupId: '44444444-4444-4444-4444-444444444444',
      duty: 'invalid-duty',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fieldErrors).toHaveProperty('profileId');
      expect(result.errors.fieldErrors).toHaveProperty('duty');
    }
  });

  it('returns formatted error if user lacks authorization for batch', async () => {
    const validPaceGroupId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const validProfileId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    serviceMocks.getPaceGroupById.mockResolvedValue({
      id: validPaceGroupId,
      batchId: 'batch-1',
    });

    mockRequireBatchAccess.mockRejectedValue(
      new AuthzErrorClass('You do not have access to this batch.', 'FORBIDDEN'),
    );

    const result = await assignPaceAdminAction({
      profileId: validProfileId,
      paceGroupId: validPaceGroupId,
      duty: 'reflection',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        'You do not have access to this batch.',
      );
    }
  });
});
