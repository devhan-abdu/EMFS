import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
    query: {
      batches: {
        findFirst: vi.fn(),
      },
    },
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
  createMoveRequest,
  getPendingMoveRequests,
  approveMoveRequest,
  rejectMoveRequest,
  getBatchMoveHistory,
  PlacementError,
} from '@/lib/services/pace-groups/placement';
import {
  approveMoveRequestAction,
  rejectMoveRequestAction,
} from '@/actions/placement';

const MOCK_BATCH_ID = 'a0000000-0000-4000-8000-000000000001';
const OTHER_BATCH_ID = 'a0000000-0000-4000-8000-000000000009';
const MOCK_PROFILE_ID = 'a0000000-0000-4000-8000-000000000002';
const MOCK_FROM_GROUP_ID = 'a0000000-0000-4000-8000-000000000003';
const MOCK_TO_GROUP_ID = 'a0000000-0000-4000-8000-000000000004';
const MOCK_REQUEST_ID = 'a0000000-0000-4000-8000-000000000005';
const MOCK_ACTOR_ID = 'a0000000-0000-4000-8000-000000000099';

describe('Pending Move Requests & History Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMoveRequest', () => {
    it('successfully creates a pending move request', async () => {
      let selectCount = 0;
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                // 1. Batch check
                if (selectCount === 1)
                  return Promise.resolve([{ id: MOCK_BATCH_ID }]);
                // 2. Enrollment check
                if (selectCount === 2) return Promise.resolve([{ id: 'bm-1' }]);
                // 3. Target group check
                if (selectCount === 3)
                  return Promise.resolve([
                    {
                      id: MOCK_TO_GROUP_ID,
                      batchId: MOCK_BATCH_ID,
                      archived: false,
                    },
                  ]);
                // 4. Current active group
                if (selectCount === 4)
                  return Promise.resolve([
                    { id: 'pgm-1', paceGroupId: MOCK_FROM_GROUP_ID },
                  ]);
                // 5. Existing pending request
                if (selectCount === 5) return Promise.resolve([]);
                return Promise.resolve([]);
              }),
            })),
          })),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: MOCK_REQUEST_ID,
                ...val,
              },
            ]),
          })),
        })),
      };

      const result = await createMoveRequest(
        {
          batchId: MOCK_BATCH_ID,
          profileId: MOCK_PROFILE_ID,
          toPaceGroupId: MOCK_TO_GROUP_ID,
          reason: 'Need earlier cadence',
        },
        mockTx as never,
      );

      expect(result.id).toBe(MOCK_REQUEST_ID);
      expect(result.status).toBe('pending');
      expect(result.fromPaceGroupId).toBe(MOCK_FROM_GROUP_ID);
      expect(result.toPaceGroupId).toBe(MOCK_TO_GROUP_ID);
      expect(result.reason).toBe('Need earlier cadence');
    });

    it('rejects if member already has an active pending request in the batch', async () => {
      let selectCount = 0;
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                if (selectCount === 1)
                  return Promise.resolve([{ id: MOCK_BATCH_ID }]);
                if (selectCount === 2) return Promise.resolve([{ id: 'bm-1' }]);
                if (selectCount === 3)
                  return Promise.resolve([
                    {
                      id: MOCK_TO_GROUP_ID,
                      batchId: MOCK_BATCH_ID,
                      archived: false,
                    },
                  ]);
                if (selectCount === 4) return Promise.resolve([]);
                if (selectCount === 5)
                  return Promise.resolve([{ id: 'req-existing' }]);
                return Promise.resolve([]);
              }),
            })),
          })),
        })),
      };

      await expect(
        createMoveRequest(
          {
            batchId: MOCK_BATCH_ID,
            profileId: MOCK_PROFILE_ID,
            toPaceGroupId: MOCK_TO_GROUP_ID,
          },
          mockTx as never,
        ),
      ).rejects.toThrowError(
        'A pending move request already exists for this member in this batch.',
      );
    });
  });

  describe('getPendingMoveRequests', () => {
    it('retrieves all pending move requests for a batch with full member and group display info', async () => {
      const mockRows = [
        {
          id: MOCK_REQUEST_ID,
          profileId: MOCK_PROFILE_ID,
          firstName: 'Abebe',
          fatherName: 'Bikila',
          userName: 'abebe',
          userEmail: 'abebe@example.com',
          appEmail: 'abebe.app@example.com',
          profileTelegram: '@abebe',
          appTelegram: null,
          profilePhone: '+251911223344',
          appPhone: null,
          appPacePreference: '20',
          currentPaceGroupId: MOCK_FROM_GROUP_ID,
          currentPaceGroupName: 'Morning Readers (10)',
          requestedPaceGroupId: MOCK_TO_GROUP_ID,
          requestedPaceGroupName: 'Fast Pace (20)',
          requestedPaceGroupSize: 20,
          status: 'pending',
          reason: 'Want to read faster',
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
      ];

      const mockExecutor = {
        query: {
          batches: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: MOCK_BATCH_ID, name: 'Batch 1' }),
          },
        },
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            innerJoin: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockImplementation(() => ({
              orderBy: vi.fn().mockResolvedValue(mockRows),
            })),
          })),
        })),
      };

      const result = await getPendingMoveRequests(
        MOCK_BATCH_ID,
        mockExecutor as never,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(MOCK_REQUEST_ID);
      expect(result[0].name).toBe('Abebe Bikila');
      expect(result[0].email).toBe('abebe@example.com');
      expect(result[0].currentPaceGroupName).toBe('Morning Readers (10)');
      expect(result[0].requestedPaceGroupName).toBe('Fast Pace (20)');
      expect(result[0].pacePreference).toBe('20');
      expect(result[0].status).toBe('pending');
    });
  });

  describe('approveMoveRequest', () => {
    it('approves request atomically: closes old membership, creates new active membership, records audit, and updates request status', async () => {
      let selectCount = 0;
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                // 1. Move request check
                if (selectCount === 1)
                  return Promise.resolve([
                    {
                      id: MOCK_REQUEST_ID,
                      batchId: MOCK_BATCH_ID,
                      profileId: MOCK_PROFILE_ID,
                      toPaceGroupId: MOCK_TO_GROUP_ID,
                      status: 'pending',
                      reason: 'Moving to faster track',
                    },
                  ]);
                // 2. Batch membership check
                if (selectCount === 2) return Promise.resolve([{ id: 'bm-1' }]);
                // 3. Target group check
                if (selectCount === 3)
                  return Promise.resolve([
                    {
                      id: MOCK_TO_GROUP_ID,
                      batchId: MOCK_BATCH_ID,
                      archived: false,
                    },
                  ]);
                // 4. Current active membership check
                if (selectCount === 4)
                  return Promise.resolve([
                    { id: 'pgm-old-1', paceGroupId: MOCK_FROM_GROUP_ID },
                  ]);
                return Promise.resolve([]);
              }),
            })),
          })),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'new-row',
                ...val,
              },
            ]),
          })),
        })),
      };

      const result = await approveMoveRequest(
        {
          requestId: MOCK_REQUEST_ID,
          batchId: MOCK_BATCH_ID,
          notes: 'Admin approved after evaluation',
        },
        MOCK_ACTOR_ID,
        mockTx as never,
      );

      expect(result.status).toBe('approved');
      expect(result.requestId).toBe(MOCK_REQUEST_ID);
      expect(result.previousMembershipId).toBe('pgm-old-1');
      expect(result.newMembership.status).toBe('active');
      expect(result.audit.fromPaceGroupId).toBe(MOCK_FROM_GROUP_ID);
      expect(result.audit.toPaceGroupId).toBe(MOCK_TO_GROUP_ID);
      expect(result.audit.moveReason).toBe('Approved move request');
      expect(result.audit.movedBy).toBe(MOCK_ACTOR_ID);

      // Verify old membership was closed and request status was updated
      expect(mockTx.update).toHaveBeenCalledTimes(2);
      // Verify new membership and audit record were inserted
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
    });

    it('throws MOVE_REQUEST_NOT_FOUND if request is missing in this batch', async () => {
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      };

      await expect(
        approveMoveRequest(
          {
            requestId: 'non-existent-request',
            batchId: MOCK_BATCH_ID,
          },
          MOCK_ACTOR_ID,
          mockTx as never,
        ),
      ).rejects.toThrowError(PlacementError);
    });
  });

  describe('rejectMoveRequest', () => {
    it('rejects pending move request and preserves group memberships intact', async () => {
      const mockExecutor = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi
                .fn()
                .mockResolvedValue([
                  { id: MOCK_REQUEST_ID, status: 'pending' },
                ]),
            })),
          })),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
      };

      const result = await rejectMoveRequest(
        {
          requestId: MOCK_REQUEST_ID,
          batchId: MOCK_BATCH_ID,
          rejectionReason: 'Target group is at maximum capacity',
        },
        MOCK_ACTOR_ID,
        mockExecutor as never,
      );

      expect(result.status).toBe('rejected');
      expect(result.requestId).toBe(MOCK_REQUEST_ID);
      expect(result.rejectionReason).toBe(
        'Target group is at maximum capacity',
      );
      expect(mockExecutor.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBatchMoveHistory', () => {
    it('retrieves historical moves strictly scoped to the batch with pagination', async () => {
      const mockAuditRows = [
        {
          id: 'audit-1',
          profileId: MOCK_PROFILE_ID,
          memberFirstName: 'Sara',
          memberFatherName: 'Tadesse',
          memberUserName: 'sara',
          memberEmail: 'sara@example.com',
          fromPaceGroupId: MOCK_FROM_GROUP_ID,
          fromPaceGroupName: 'Group A',
          toPaceGroupId: MOCK_TO_GROUP_ID,
          toPaceGroupName: 'Group B',
          moveReason: 'Approved move request',
          movedById: MOCK_ACTOR_ID,
          actorFirstName: 'Admin',
          actorFatherName: 'User',
          actorUserName: 'admin',
          moveDate: new Date('2026-09-10T12:00:00Z'),
          notes: 'Shifted schedule',
        },
      ];

      const mockExecutor = {
        query: {
          batches: {
            findFirst: vi.fn().mockResolvedValue({ id: MOCK_BATCH_ID }),
          },
        },
        select: vi.fn().mockImplementation((fields) => {
          if (fields && fields.totalCount) {
            return {
              from: vi.fn().mockImplementation(() => ({
                innerJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue([{ totalCount: 1 }]),
              })),
            };
          }
          return {
            from: vi.fn().mockImplementation(() => ({
              innerJoin: vi.fn().mockReturnThis(),
              leftJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockImplementation(() => ({
                orderBy: vi.fn().mockImplementation(() => ({
                  limit: vi.fn().mockImplementation(() => ({
                    offset: vi.fn().mockResolvedValue(mockAuditRows),
                  })),
                })),
              })),
            })),
          };
        }),
      };

      const result = await getBatchMoveHistory(
        {
          batchId: MOCK_BATCH_ID,
          page: 1,
          limit: 10,
        },
        mockExecutor as never,
      );

      expect(result.batchId).toBe(MOCK_BATCH_ID);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].memberName).toBe('Sara Tadesse');
      expect(result.items[0].fromPaceGroupName).toBe('Group A');
      expect(result.items[0].toPaceGroupName).toBe('Group B');
      expect(result.items[0].movedByName).toBe('Admin User');
    });
  });
});

describe('Move Request Server Actions Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects approveMoveRequestAction when actor lacks batch access', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass(
        'FORBIDDEN',
        'You are not an assigned admin for this batch.',
      );
    });

    const result = await approveMoveRequestAction({
      requestId: MOCK_REQUEST_ID,
      batchId: MOCK_BATCH_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    }
  });

  it('rejects rejectMoveRequestAction when actor lacks batch access', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass(
        'FORBIDDEN',
        'You are not an assigned admin for this batch.',
      );
    });

    const result = await rejectMoveRequestAction({
      requestId: MOCK_REQUEST_ID,
      batchId: MOCK_BATCH_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    }
  });
});
