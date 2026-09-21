import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

const { AuthzErrorClass, mockRequireBatchAccess } = vi.hoisted(() => {
  class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
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

vi.mock('@/lib/auth/authorize', () => ({
  AuthzError: AuthzErrorClass,
  requireBatchAccess: (...args: unknown[]) => mockRequireBatchAccess(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  assignMemberToPaceGroup,
  moveMemberToPaceGroup,
  PlacementError,
} from '@/lib/services/pace-groups/placement';
import { assignMemberAction, moveMemberAction } from '@/actions/placement';

const MOCK_BATCH_ID = 'a0000000-0000-4000-8000-000000000001';
const OTHER_BATCH_ID = 'a0000000-0000-4000-8000-000000000009';
const MOCK_PROFILE_ID = 'a0000000-0000-4000-8000-000000000002';
const MOCK_GROUP_1_ID = 'a0000000-0000-4000-8000-000000000003';
const MOCK_GROUP_2_ID = 'a0000000-0000-4000-8000-000000000004';
const MOCK_ACTOR_ID = 'a0000000-0000-4000-8000-000000000005';

function createMockTx(options: {
  batchExists?: boolean;
  memberEnrolled?: boolean;
  targetGroupExists?: boolean;
  targetGroupBatchId?: string;
  targetGroupArchived?: boolean;
  existingActiveMembership?: { id: string; paceGroupId: string } | null;
}) {
  const {
    batchExists = true,
    memberEnrolled = true,
    targetGroupExists = true,
    targetGroupBatchId = MOCK_BATCH_ID,
    targetGroupArchived = false,
    existingActiveMembership = null,
  } = options;

  let selectCallCount = 0;

  const selectMock = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve(
              batchExists ? [{ id: MOCK_BATCH_ID, name: 'Batch 5' }] : [],
            );
          }
          if (selectCallCount === 2) {
            return Promise.resolve(
              memberEnrolled ? [{ id: 'bm-1', status: 'active' }] : [],
            );
          }
          if (selectCallCount === 3) {
            return Promise.resolve(
              targetGroupExists
                ? [
                    {
                      id: MOCK_GROUP_1_ID,
                      batchId: targetGroupBatchId,
                      archived: targetGroupArchived,
                    },
                  ]
                : [],
            );
          }
          if (selectCallCount === 4) {
            return Promise.resolve(
              existingActiveMembership ? [existingActiveMembership] : [],
            );
          }
          return Promise.resolve([]);
        }),
      })),
    })),
  }));

  const insertedMembership = {
    id: 'pgm-new',
    profileId: MOCK_PROFILE_ID,
    batchId: MOCK_BATCH_ID,
    paceGroupId: MOCK_GROUP_1_ID,
    status: 'active',
  };

  const insertedAudit = {
    id: 'audit-1',
    profileId: MOCK_PROFILE_ID,
    fromPaceGroupId: existingActiveMembership?.paceGroupId ?? null,
    toPaceGroupId: MOCK_GROUP_1_ID,
    moveReason: 'Initial placement',
    movedBy: MOCK_ACTOR_ID,
  };

  let insertCount = 0;
  const insertMock = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockImplementation(() => {
        insertCount++;
        if (insertCount === 1) return Promise.resolve([insertedMembership]);
        return Promise.resolve([insertedAudit]);
      }),
    })),
  }));

  const updateMock = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  }));

  return {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
  };
}

describe('Individual Member Placement Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assignMemberToPaceGroup', () => {
    it('successfully assigns an unplaced member to a pace group and writes audit record', async () => {
      const tx = createMockTx({
        batchExists: true,
        memberEnrolled: true,
        targetGroupExists: true,
        targetGroupBatchId: MOCK_BATCH_ID,
        targetGroupArchived: false,
        existingActiveMembership: null,
      });

      const result = await assignMemberToPaceGroup(
        {
          batchId: MOCK_BATCH_ID,
          profileId: MOCK_PROFILE_ID,
          paceGroupId: MOCK_GROUP_1_ID,
          notes: 'Assigned during orientation',
        },
        MOCK_ACTOR_ID,
        tx as never,
      );

      expect(result.membership.status).toBe('active');
      expect(result.audit.fromPaceGroupId).toBeNull();
      expect(result.audit.toPaceGroupId).toBe(MOCK_GROUP_1_ID);
      expect(result.audit.moveReason).toBe('Initial placement');
      expect(tx.insert).toHaveBeenCalledTimes(2);
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('throws BATCH_NOT_FOUND when batch does not exist', async () => {
      const tx = createMockTx({ batchExists: false });

      await expect(
        assignMemberToPaceGroup(
          {
            batchId: '00000000-0000-0000-0000-000000000000',
            profileId: MOCK_PROFILE_ID,
            paceGroupId: MOCK_GROUP_1_ID,
          },
          MOCK_ACTOR_ID,
          tx as never,
        ),
      ).rejects.toThrowError(PlacementError);
    });

    it('throws MEMBER_NOT_ENROLLED when member is not actively enrolled in batch', async () => {
      const tx = createMockTx({ memberEnrolled: false });

      await expect(
        assignMemberToPaceGroup(
          {
            batchId: MOCK_BATCH_ID,
            profileId: MOCK_PROFILE_ID,
            paceGroupId: MOCK_GROUP_1_ID,
          },
          MOCK_ACTOR_ID,
          tx as never,
        ),
      ).rejects.toThrowError(PlacementError);
    });

    it('throws PACE_GROUP_NOT_FOUND when target group belongs to another batch', async () => {
      const tx = createMockTx({
        targetGroupBatchId: OTHER_BATCH_ID,
      });

      await expect(
        assignMemberToPaceGroup(
          {
            batchId: MOCK_BATCH_ID,
            profileId: MOCK_PROFILE_ID,
            paceGroupId: MOCK_GROUP_1_ID,
          },
          MOCK_ACTOR_ID,
          tx as never,
        ),
      ).rejects.toThrowError(PlacementError);
    });

    it('throws PACE_GROUP_ARCHIVED when target group is archived', async () => {
      const tx = createMockTx({
        targetGroupArchived: true,
      });

      await expect(
        assignMemberToPaceGroup(
          {
            batchId: MOCK_BATCH_ID,
            profileId: MOCK_PROFILE_ID,
            paceGroupId: MOCK_GROUP_1_ID,
          },
          MOCK_ACTOR_ID,
          tx as never,
        ),
      ).rejects.toThrowError(
        'Cannot assign a member to an archived pace group.',
      );
    });

    it('throws MEMBER_ALREADY_PLACED when member is already placed in an active group', async () => {
      const tx = createMockTx({
        existingActiveMembership: {
          id: 'pgm-existing',
          paceGroupId: MOCK_GROUP_2_ID,
        },
      });

      await expect(
        assignMemberToPaceGroup(
          {
            batchId: MOCK_BATCH_ID,
            profileId: MOCK_PROFILE_ID,
            paceGroupId: MOCK_GROUP_1_ID,
          },
          MOCK_ACTOR_ID,
          tx as never,
        ),
      ).rejects.toThrowError(PlacementError);
    });
  });

  describe('moveMemberToPaceGroup', () => {
    it('successfully moves a placed member, closes old membership, and writes audit record', async () => {
      const tx = createMockTx({
        batchExists: true,
        memberEnrolled: true,
        targetGroupExists: true,
        targetGroupBatchId: MOCK_BATCH_ID,
        targetGroupArchived: false,
        existingActiveMembership: {
          id: 'pgm-old',
          paceGroupId: MOCK_GROUP_2_ID,
        },
      });

      const result = await moveMemberToPaceGroup(
        {
          batchId: MOCK_BATCH_ID,
          profileId: MOCK_PROFILE_ID,
          toPaceGroupId: MOCK_GROUP_1_ID,
          moveReason: 'Requested faster reading rhythm',
        },
        MOCK_ACTOR_ID,
        tx as never,
      );

      expect(result.previousMembershipId).toBe('pgm-old');
      expect(result.newMembership.status).toBe('active');
      expect(tx.update).toHaveBeenCalledTimes(1);
      expect(tx.insert).toHaveBeenCalledTimes(2);
    });

    it('throws MEMBER_NOT_PLACED when member has no active group to move from', async () => {
      const tx = createMockTx({
        existingActiveMembership: null,
      });

      await expect(
        moveMemberToPaceGroup(
          {
            batchId: MOCK_BATCH_ID,
            profileId: MOCK_PROFILE_ID,
            toPaceGroupId: MOCK_GROUP_1_ID,
            moveReason: 'Pace change',
          },
          MOCK_ACTOR_ID,
          tx as never,
        ),
      ).rejects.toThrowError(
        'Member does not have an active pace group assignment to move from.',
      );
    });

    it('throws SAME_PACE_GROUP when moving to the same group they are currently in', async () => {
      const tx = createMockTx({
        existingActiveMembership: {
          id: 'pgm-current',
          paceGroupId: MOCK_GROUP_1_ID,
        },
      });

      await expect(
        moveMemberToPaceGroup(
          {
            batchId: MOCK_BATCH_ID,
            profileId: MOCK_PROFILE_ID,
            toPaceGroupId: MOCK_GROUP_1_ID,
            moveReason: 'Same group move',
          },
          MOCK_ACTOR_ID,
          tx as never,
        ),
      ).rejects.toThrowError('Member is already in the target pace group.');
    });
  });
});

describe('Placement Server Actions Authorization', () => {
  it('rejects assignMemberAction when user lacks batch access', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass(
        'FORBIDDEN',
        'You are not an assigned admin for this batch.',
      );
    });

    const result = await assignMemberAction({
      batchId: MOCK_BATCH_ID,
      profileId: MOCK_PROFILE_ID,
      paceGroupId: MOCK_GROUP_1_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    }
  });

  it('rejects moveMemberAction when user lacks batch access', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass(
        'FORBIDDEN',
        'You are not an assigned admin for this batch.',
      );
    });

    const result = await moveMemberAction({
      batchId: MOCK_BATCH_ID,
      profileId: MOCK_PROFILE_ID,
      toPaceGroupId: MOCK_GROUP_1_ID,
      moveReason: 'Pace change request',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    }
  });
});
