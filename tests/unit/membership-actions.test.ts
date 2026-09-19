vi.mock('server-only', () => ({}));

vi.mock('@/db', () => ({
  db: {
    query: {
      batchMemberships: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/authorize', () => ({
  requireRole: vi.fn(),
  requireBatchAccess: vi.fn(),
  AuthzError: class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'AuthzError';
    }
  },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import {
  transitionMembershipAction,
  moveMembershipAction,
  reenterMembershipAction,
} from '@/actions/membership';
import * as authorizeModule from '@/lib/auth/authorize';
import * as membershipService from '@/lib/services/membership';
import type { batchMemberships } from '@/db/schema';

type BatchMembershipRecord = typeof batchMemberships.$inferSelect;

function createMockMembership(
  id: string,
  batchId: string,
  profileId = 'p-1',
): BatchMembershipRecord {
  return {
    id,
    profileId,
    batchId,
    status: 'active',
    startDate: new Date('2026-01-01'),
    endDate: null,
    removalReason: null,
    createdAt: new Date('2026-01-01'),
  };
}

vi.mock('@/lib/services/membership', () => ({
  createBatchMembership: vi.fn(),
  transitionBatchMembership: vi.fn(),
  moveBatchMembership: vi.fn(),
  reenterBatchMembership: vi.fn(),
  MembershipError: class MembershipError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'MembershipError';
    }
  },
}));

describe('Membership Actions - Actor Identity & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('16. actor_id comes from trusted server-side session identity, not client input', async () => {
    const trustedProfileId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const membershipId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const batchId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(
      createMockMembership(membershipId, batchId),
    );

    vi.mocked(authorizeModule.requireBatchAccess).mockResolvedValue({
      authUserId: 'auth-1',
      email: 'admin@example.com',
      profile: {
        id: trustedProfileId,
        authUserId: 'auth-1',
        role: 'batch_admin',
        firstName: 'Admin',
        fatherName: 'User',
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    vi.mocked(membershipService.transitionBatchMembership).mockResolvedValue({
      id: membershipId,
      profileId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      batchId,
      status: 'removed',
      startDate: new Date(),
      endDate: new Date(),
      removalReason: 'Test removal',
      createdAt: new Date(),
    });

    const clientInput = {
      membershipId,
      targetStatus: 'removed',
      reason: 'Test removal',
      actorId: 'malicious-fake-actor-id', // Client tries to spoof actorId
    };

    const res = await transitionMembershipAction(clientInput);
    expect(res.ok).toBe(true);

    // Verify service was called with the trusted profile ID, ignoring client's spoofed actorId
    expect(membershipService.transitionBatchMembership).toHaveBeenCalledWith(
      membershipId,
      'removed',
      'Test removal',
      trustedProfileId,
    );
  });

  it('17. unauthorized clients without appropriate role are rejected', async () => {
    const membershipId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const batchId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(
      createMockMembership(membershipId, batchId),
    );

    vi.mocked(authorizeModule.requireBatchAccess).mockRejectedValue(
      new authorizeModule.AuthzError('FORBIDDEN', 'Forbidden'),
    );

    const res = await transitionMembershipAction({
      membershipId,
      targetStatus: 'removed',
    });

    expect(res.ok).toBe(false);
    expect(membershipService.transitionBatchMembership).not.toHaveBeenCalled();
  });

  it('moveMembershipAction passes trusted profile ID as actorId', async () => {
    const trustedProfileId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const membershipId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const newBatchId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(
      createMockMembership(membershipId, 'old-batch-id'),
    );

    vi.mocked(authorizeModule.requireBatchAccess).mockResolvedValue({
      authUserId: 'auth-1',
      email: 'admin@example.com',
      profile: {
        id: trustedProfileId,
        authUserId: 'auth-1',
        role: 'batch_admin',
        firstName: 'Admin',
        fatherName: 'User',
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    vi.mocked(membershipService.moveBatchMembership).mockResolvedValue({
      id: membershipId,
      profileId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      batchId: newBatchId,
      status: 'active',
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    });

    const res = await moveMembershipAction({
      membershipId,
      newBatchId,
      reason: 'Move to new batch',
    });

    expect(res.ok).toBe(true);
    expect(membershipService.moveBatchMembership).toHaveBeenCalledWith(
      membershipId,
      newBatchId,
      trustedProfileId,
      'Move to new batch',
    );
  });

  it('reenterMembershipAction passes trusted profile ID as actorId', async () => {
    const trustedProfileId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const profileId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
    const fromBatchId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
    const toBatchId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';

    vi.mocked(authorizeModule.requireBatchAccess).mockResolvedValue({
      authUserId: 'auth-1',
      email: 'admin@example.com',
      profile: {
        id: trustedProfileId,
        authUserId: 'auth-1',
        role: 'batch_admin',
        firstName: 'Admin',
        fatherName: 'User',
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    vi.mocked(membershipService.reenterBatchMembership).mockResolvedValue({
      id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
      profileId,
      batchId: toBatchId,
      status: 'applied',
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    });

    const res = await reenterMembershipAction({
      profileId,
      fromBatchId,
      toBatchId,
      targetStatus: 'applied',
      reason: 'Re-entering applicant',
    });

    expect(res.ok).toBe(true);
    expect(membershipService.reenterBatchMembership).toHaveBeenCalledWith(
      profileId,
      fromBatchId,
      toBatchId,
      'applied',
      trustedProfileId,
      'Re-entering applicant',
    );
  });
});
