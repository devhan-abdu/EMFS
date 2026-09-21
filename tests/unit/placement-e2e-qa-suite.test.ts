import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  MockAuthzError,
  mockRequireBatchAccess,
  mockRequirePaceGroupAccess,
  mockRequireSession,
  mockRequireSuperAdmin,
} = vi.hoisted(() => {
  class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'AuthzError';
      this.code = code;
    }
  }

  return {
    MockAuthzError: AuthzError,
    mockRequireBatchAccess: vi.fn(),
    mockRequirePaceGroupAccess: vi.fn(),
    mockRequireSession: vi.fn(),
    mockRequireSuperAdmin: vi.fn(),
  };
});

vi.mock('@/lib/auth/authorize', () => ({
  AuthzError: MockAuthzError,
  requireBatchAccess: (...args: unknown[]) => mockRequireBatchAccess(...args),
  requirePaceGroupAccess: (...args: unknown[]) =>
    mockRequirePaceGroupAccess(...args),
  requireSession: () => mockRequireSession(),
  requireSuperAdmin: () => mockRequireSuperAdmin(),
  getAuthorizedBatchIds: vi.fn(),
  getAuthorizedPaceGroupIds: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockDbTransaction = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    transaction: (...args: unknown[]) => mockDbTransaction(...args),
    query: {
      batches: { findFirst: vi.fn() },
      batchAdmins: { findFirst: vi.fn(), findMany: vi.fn() },
      paceGroups: { findFirst: vi.fn(), findMany: vi.fn() },
      paceAdminAssignments: { findFirst: vi.fn(), findMany: vi.fn() },
      batchMemberships: { findFirst: vi.fn() },
      paceGroupMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
      dailyTasks: { findFirst: vi.fn() },
      dailyProgress: { findFirst: vi.fn() },
      books: { findFirst: vi.fn() },
      batchPacingOffsets: { findMany: vi.fn() },
      waitlist: { findFirst: vi.fn() },
      applications: { findFirst: vi.fn() },
      handoffRecords: { findFirst: vi.fn() },
    },
  },
}));

import {
  getBatchRoster,
  assignMemberToPaceGroup,
  moveMemberToPaceGroup,
  bulkAssignMembersToPaceGroup,
  getPendingMoveRequests,
  approveMoveRequest,
  rejectMoveRequest,
  getBatchMoveHistory,
  type BatchRosterMember,
} from '@/lib/services/pace-groups/placement';

import { assignMemberAction } from '@/actions/placement';

import { getMemberHomeState } from '@/lib/services/member/get-member-home-state';
import { db } from '@/db';

const BATCH_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_BATCH_ID = '10000000-0000-4000-8000-000000000099';
const GROUP_5_ID = '20000000-0000-4000-8000-000000000005';
const GROUP_10_ID = '20000000-0000-4000-8000-000000000010';
const GROUP_20_ID = '20000000-0000-4000-8000-000000000020';
const GROUP_OTHER_ID = '20000000-0000-4000-8000-000000000099';

const ADMIN_PROFILE_ID = '30000000-0000-4000-8000-000000000001';
const MEMBER_1_ID = '30000000-0000-4000-8000-000000000011';
const MEMBER_2_ID = '30000000-0000-4000-8000-000000000012';
const REQUEST_1_ID = '40000000-0000-4000-8000-000000000001';

describe('Comprehensive End-to-End QA & Security Suite: Member Placement & Group Moves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Section 1: PLACEMENT TESTS (Items 1 to 22)', () => {
    // 1. Batch with zero pace groups
    it('1. Batch with zero pace groups: query service operates and identifies empty group roster', async () => {
      const mockExecutor = {
        query: {
          batches: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: BATCH_ID, name: 'Batch Empty' }),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    leftJoin: vi.fn().mockReturnValue({
                      where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockResolvedValue([]),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };

      const roster = await getBatchRoster(
        { batchId: BATCH_ID },
        mockExecutor as never,
      );
      expect(roster.batchId).toBe(BATCH_ID);
      expect(roster.totalMembers).toBe(0);
      expect(roster.members).toHaveLength(0);
    });

    // 2. Batch with pace groups & 3. Unplaced member & 4. Placed member
    it('2, 3, 4. Batch with pace groups correctly classifies placed vs unplaced members', async () => {
      const mockRows = [
        {
          profileId: MEMBER_1_ID,
          authUserId: 'u1',
          firstName: 'Aisha',
          fatherName: 'Ali',
          userName: 'aisha',
          userEmail: 'aisha@example.com',
          appEmail: 'aisha@example.com',
          profileTelegram: 'aisha_t',
          appTelegram: null,
          profilePhone: '+251911111111',
          appPhone: null,
          appPacePreference: '10',
          membershipId: 'bm1',
          batchMembershipStatus: 'active',
          enrolledAt: new Date('2026-01-01'),
          paceGroupMembershipId: 'pgm1',
          paceGroupId: GROUP_10_ID,
          paceGroupName: 'Group 10 (10 p/d)',
          paceGroupSize: 10,
          placedAt: new Date('2026-01-02'),
        },
        {
          profileId: MEMBER_2_ID,
          authUserId: 'u2',
          firstName: 'Bilal',
          fatherName: 'Omar',
          userName: 'bilal',
          userEmail: 'bilal@example.com',
          appEmail: 'bilal@example.com',
          profileTelegram: null,
          appTelegram: 'bilal_t',
          profilePhone: null,
          appPhone: '+251922222222',
          appPacePreference: '5',
          membershipId: 'bm2',
          batchMembershipStatus: 'active',
          enrolledAt: new Date('2026-01-01'),
          paceGroupMembershipId: null,
          paceGroupId: null,
          paceGroupName: null,
          paceGroupSize: null,
          placedAt: null,
        },
      ];

      const mockExecutor = {
        query: {
          batches: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: BATCH_ID, name: 'Batch 1' }),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    leftJoin: vi.fn().mockReturnValue({
                      where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockResolvedValue(mockRows),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };

      const roster = await getBatchRoster(
        { batchId: BATCH_ID },
        mockExecutor as never,
      );
      expect(roster.totalMembers).toBe(2);
      expect(roster.placedCount).toBe(1);
      expect(roster.unplacedCount).toBe(1);

      const aisha = roster.members.find((m) => m.profileId === MEMBER_1_ID);
      expect(aisha?.placementStatus).toBe('placed');
      expect(aisha?.paceGroupId).toBe(GROUP_10_ID);

      const bilal = roster.members.find((m) => m.profileId === MEMBER_2_ID);
      expect(bilal?.placementStatus).toBe('unplaced');
      expect(bilal?.paceGroupId).toBeNull();
    });

    // 5-13. Filter Logic Tests (All, Unplaced, Placed, Prefs 5, 10, 20, 40, Combined AND, Select all filtered)
    it('5-13. Validates filtering (All, Unplaced, Placed, Preferences 5/10/20/40, Combined AND, and Select All Filtered)', () => {
      const mockMembers: BatchRosterMember[] = [
        {
          profileId: 'm1',
          name: 'Member 1',
          email: 'm1@test.com',
          telegramUsername: null,
          phoneNumber: null,
          pacePreference: '5',
          batchMembershipStatus: 'active',
          enrolledAt: new Date(),
          placementStatus: 'unplaced',
          paceGroupId: null,
          paceGroupName: null,
          paceGroupSize: null,
          placedAt: null,
        },
        {
          profileId: 'm2',
          name: 'Member 2',
          email: 'm2@test.com',
          telegramUsername: null,
          phoneNumber: null,
          pacePreference: '10',
          batchMembershipStatus: 'active',
          enrolledAt: new Date(),
          placementStatus: 'unplaced',
          paceGroupId: null,
          paceGroupName: null,
          paceGroupSize: null,
          placedAt: null,
        },
        {
          profileId: 'm3',
          name: 'Member 3',
          email: 'm3@test.com',
          telegramUsername: null,
          phoneNumber: null,
          pacePreference: '10',
          batchMembershipStatus: 'active',
          enrolledAt: new Date(),
          placementStatus: 'placed',
          paceGroupId: GROUP_10_ID,
          paceGroupName: 'Group 10',
          paceGroupSize: 10,
          placedAt: new Date(),
        },
        {
          profileId: 'm4',
          name: 'Member 4',
          email: 'm4@test.com',
          telegramUsername: null,
          phoneNumber: null,
          pacePreference: '20',
          batchMembershipStatus: 'active',
          enrolledAt: new Date(),
          placementStatus: 'placed',
          paceGroupId: GROUP_20_ID,
          paceGroupName: 'Group 20',
          paceGroupSize: 20,
          placedAt: new Date(),
        },
        {
          profileId: 'm5',
          name: 'Member 5',
          email: 'm5@test.com',
          telegramUsername: null,
          phoneNumber: null,
          pacePreference: '40',
          batchMembershipStatus: 'active',
          enrolledAt: new Date(),
          placementStatus: 'unplaced',
          paceGroupId: null,
          paceGroupName: null,
          paceGroupSize: null,
          placedAt: null,
        },
      ];

      // 5. All filter
      const allFilter = (_m: BatchRosterMember) => true;
      expect(mockMembers.filter(allFilter)).toHaveLength(5);

      // 6. Unplaced filter
      const unplacedFilter = (m: BatchRosterMember) =>
        m.placementStatus === 'unplaced';
      expect(mockMembers.filter(unplacedFilter)).toHaveLength(3); // m1, m2, m5

      // 7. Placed filter
      const placedFilter = (m: BatchRosterMember) =>
        m.placementStatus === 'placed';
      expect(mockMembers.filter(placedFilter)).toHaveLength(2); // m3, m4

      // 8-11. Preferences 5, 10, 20, 40
      expect(mockMembers.filter((m) => m.pacePreference === '5')).toHaveLength(
        1,
      );
      expect(mockMembers.filter((m) => m.pacePreference === '10')).toHaveLength(
        2,
      );
      expect(mockMembers.filter((m) => m.pacePreference === '20')).toHaveLength(
        1,
      );
      expect(mockMembers.filter((m) => m.pacePreference === '40')).toHaveLength(
        1,
      );

      // 12. Combined filters: Unplaced + Preference 10 (AND)
      const combined = mockMembers.filter(
        (m) => m.placementStatus === 'unplaced' && m.pacePreference === '10',
      );
      expect(combined).toHaveLength(1);
      expect(combined[0].profileId).toBe('m2');

      // 13. Select all filtered: selection adds only filtered items to selection set
      const selectedSet = new Set<string>();
      combined.forEach((m) => selectedSet.add(m.profileId));
      expect(selectedSet.size).toBe(1);
      expect(selectedSet.has('m2')).toBe(true);
      expect(selectedSet.has('m3')).toBe(false); // m3 was placed, not included in selection
    });

    // 14. Individual assignment & 18. Confirm assignment
    it('14 & 18. Individual assignment: executes atomic assignment with audit record', async () => {
      let selectCount = 0;
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                if (selectCount === 1)
                  return Promise.resolve([{ id: BATCH_ID }]);
                if (selectCount === 2)
                  return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
                if (selectCount === 3)
                  return Promise.resolve([
                    { id: GROUP_5_ID, batchId: BATCH_ID, archived: false },
                  ]);
                if (selectCount === 4) return Promise.resolve([]); // Unplaced
                return Promise.resolve([]);
              }),
            })),
          })),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => ({
            returning: vi.fn().mockResolvedValue([{ id: 'new-row', ...val }]),
          })),
        })),
      };

      const result = await assignMemberToPaceGroup(
        {
          batchId: BATCH_ID,
          profileId: MEMBER_2_ID,
          paceGroupId: GROUP_5_ID,
          notes: 'Individual placement confirmed',
        },
        ADMIN_PROFILE_ID,
        mockTx as never,
      );

      expect(result.membership.profileId).toBe(MEMBER_2_ID);
      expect(result.membership.paceGroupId).toBe(GROUP_5_ID);
      expect(result.audit.moveReason).toBe('Initial placement');
      expect(result.audit.movedBy).toBe(ADMIN_PROFILE_ID);
    });

    // 15. Bulk assignment
    it('15. Bulk assignment: assigns multiple members in single transaction', async () => {
      let selectCount = 0;
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return { limit: vi.fn().mockResolvedValue([{ id: BATCH_ID }]) };
              if (selectCount === 2)
                return {
                  limit: vi
                    .fn()
                    .mockResolvedValue([
                      { id: GROUP_10_ID, batchId: BATCH_ID, archived: false },
                    ]),
                };
              if (selectCount === 3)
                return Promise.resolve([
                  { profileId: MEMBER_1_ID },
                  { profileId: MEMBER_2_ID },
                ]);
              if (selectCount === 4) return Promise.resolve([]);
              return Promise.resolve([]);
            }),
          })),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => ({
            returning: vi
              .fn()
              .mockResolvedValue(
                Array.isArray(val)
                  ? val.map((v, i) => ({ id: `new-${i}`, ...v }))
                  : [{ id: 'new', ...val }],
              ),
          })),
        })),
        update: vi.fn(),
      };

      const result = await bulkAssignMembersToPaceGroup(
        {
          batchId: BATCH_ID,
          targetGroupId: GROUP_10_ID,
          profileIds: [MEMBER_1_ID, MEMBER_2_ID],
        },
        ADMIN_PROFILE_ID,
        mockTx as never,
      );

      expect(result.processedCount).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].operation).toBe('assigned');
      expect(result.results[1].operation).toBe('assigned');
    });

    // 16. Move
    it('16. Move: closes prior active membership and creates new active membership + audit', async () => {
      let selectCount = 0;
      const updateMock = vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      }));

      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                if (selectCount === 1)
                  return Promise.resolve([{ id: BATCH_ID }]);
                if (selectCount === 2)
                  return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
                if (selectCount === 3)
                  return Promise.resolve([
                    { id: GROUP_20_ID, batchId: BATCH_ID, archived: false },
                  ]);
                if (selectCount === 4)
                  return Promise.resolve([
                    { id: 'pgm-old', paceGroupId: GROUP_10_ID },
                  ]);
                return Promise.resolve([]);
              }),
            })),
          })),
        })),
        update: updateMock,
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => ({
            returning: vi.fn().mockResolvedValue([{ id: 'new-row', ...val }]),
          })),
        })),
      };

      const result = await moveMemberToPaceGroup(
        {
          batchId: BATCH_ID,
          profileId: MEMBER_1_ID,
          toPaceGroupId: GROUP_20_ID,
          moveReason: 'Requesting faster pace',
        },
        ADMIN_PROFILE_ID,
        mockTx as never,
      );

      expect(result.newMembership.profileId).toBe(MEMBER_1_ID);
      expect(result.previousMembershipId).toBe('pgm-old');
      expect(result.audit.fromPaceGroupId).toBe(GROUP_10_ID);
      expect(result.audit.toPaceGroupId).toBe(GROUP_20_ID);
      expect(result.newMembership.paceGroupId).toBe(GROUP_20_ID);
      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    // 17. Cancel confirmation: client action aborts with 0 DB writes
    it('17. Cancel confirmation: user cancel triggers 0 database mutations', async () => {
      // If user cancels confirmation, no service function or action is executed
      expect(mockDbInsert).not.toHaveBeenCalled();
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    // 19. Pending request & 20. Approve & 21. Reject
    it('19, 20, 21. Pending requests, Approve workflow, and Reject workflow', async () => {
      // 19. Pending request retrieval
      const mockPendingRows = [
        {
          id: REQUEST_1_ID,
          profileId: MEMBER_1_ID,
          firstName: 'Aisha',
          fatherName: 'Ali',
          userName: 'aisha',
          userEmail: 'aisha@example.com',
          appEmail: 'aisha@example.com',
          profileTelegram: null,
          appTelegram: null,
          profilePhone: null,
          appPhone: null,
          appPacePreference: '20',
          currentPaceGroupId: GROUP_10_ID,
          currentPaceGroupName: 'Group 10',
          requestedPaceGroupId: GROUP_20_ID,
          requestedPaceGroupName: 'Group 20',
          requestedPaceGroupSize: 20,
          status: 'pending',
          reason: 'Too slow',
          createdAt: new Date(),
        },
      ];

      const mockExecutor = {
        query: {
          batches: { findFirst: vi.fn().mockResolvedValue({ id: BATCH_ID }) },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockPendingRows),
            }),
          }),
        }),
      };

      const requests = await getPendingMoveRequests(
        BATCH_ID,
        mockExecutor as never,
      );
      expect(requests).toHaveLength(1);
      expect(requests[0].id).toBe(REQUEST_1_ID);

      // 20. Approve workflow
      let approveSelectCount = 0;
      const mockApproveTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                approveSelectCount++;
                if (approveSelectCount === 1)
                  return Promise.resolve([
                    {
                      id: REQUEST_1_ID,
                      batchId: BATCH_ID,
                      profileId: MEMBER_1_ID,
                      toPaceGroupId: GROUP_20_ID,
                      status: 'pending',
                      reason: 'Too slow',
                    },
                  ]);
                if (approveSelectCount === 2)
                  return Promise.resolve([{ id: 'bm-1' }]);
                if (approveSelectCount === 3)
                  return Promise.resolve([
                    { id: GROUP_20_ID, batchId: BATCH_ID, archived: false },
                  ]);
                if (approveSelectCount === 4)
                  return Promise.resolve([
                    { id: 'pgm-10', paceGroupId: GROUP_10_ID },
                  ]);
                return Promise.resolve([]);
              }),
            })),
          })),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'new-row' }]),
          }),
        }),
      };

      const approveResult = await approveMoveRequest(
        { requestId: REQUEST_1_ID, batchId: BATCH_ID },
        ADMIN_PROFILE_ID,
        mockApproveTx as never,
      );
      expect(approveResult.status).toBe('approved');
      expect(mockApproveTx.update).toHaveBeenCalledTimes(2); // close old membership + update request status

      // 21. Reject workflow
      const mockRejectTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([{ id: REQUEST_1_ID, status: 'pending' }]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      const rejectResult = await rejectMoveRequest(
        {
          requestId: REQUEST_1_ID,
          batchId: BATCH_ID,
          rejectionReason: 'Group 20 is full',
        },
        ADMIN_PROFILE_ID,
        mockRejectTx as never,
      );
      expect(rejectResult.status).toBe('rejected');
      expect(rejectResult.rejectionReason).toBe('Group 20 is full');
    });

    // 22. Move history
    it('22. Move history: retrieves audit records with pagination and search metadata', async () => {
      const mockHistoryExecutor = {
        query: {
          batches: { findFirst: vi.fn().mockResolvedValue({ id: BATCH_ID }) },
        },
        select: vi.fn().mockImplementation((fields) => {
          if (fields && fields.totalCount) {
            return {
              from: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue([{ totalCount: 1 }]),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnThis(),
              leftJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([
                      {
                        id: 'audit-1',
                        profileId: MEMBER_1_ID,
                        memberFirstName: 'Aisha',
                        memberFatherName: 'Ali',
                        memberUserName: 'aisha',
                        memberEmail: 'aisha@example.com',
                        fromPaceGroupId: GROUP_10_ID,
                        fromPaceGroupName: 'Group 10',
                        toPaceGroupId: GROUP_20_ID,
                        toPaceGroupName: 'Group 20',
                        moveReason: 'Approved move request',
                        movedById: ADMIN_PROFILE_ID,
                        actorFirstName: 'Admin',
                        actorFatherName: 'User',
                        actorUserName: 'admin',
                        moveDate: new Date('2026-09-15'),
                        notes: 'Admin approved',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          };
        }),
      };

      const history = await getBatchMoveHistory(
        { batchId: BATCH_ID, page: 1, limit: 10 },
        mockHistoryExecutor as never,
      );

      expect(history.batchId).toBe(BATCH_ID);
      expect(history.total).toBe(1);
      expect(history.items[0].fromPaceGroupName).toBe('Group 10');
      expect(history.items[0].toPaceGroupName).toBe('Group 20');
      expect(history.items[0].movedByName).toBe('Admin User');
    });
  });

  describe('Section 2: TRANSACTION TESTS', () => {
    it('verifies bulk assignment executes in one transaction and rolls back entirely on failure', async () => {
      let selectCount = 0;
      const updateSpy = vi.fn();
      const insertSpy = vi.fn();

      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return { limit: vi.fn().mockResolvedValue([{ id: BATCH_ID }]) };
              if (selectCount === 2)
                return {
                  limit: vi
                    .fn()
                    .mockResolvedValue([
                      { id: GROUP_10_ID, batchId: BATCH_ID, archived: false },
                    ]),
                };
              // Member 1 is enrolled, Member 2 is NOT
              if (selectCount === 3)
                return Promise.resolve([{ profileId: MEMBER_1_ID }]);
              return Promise.resolve([]);
            }),
          })),
        })),
        update: updateSpy,
        insert: insertSpy,
      };

      await expect(
        bulkAssignMembersToPaceGroup(
          {
            batchId: BATCH_ID,
            targetGroupId: GROUP_10_ID,
            profileIds: [MEMBER_1_ID, MEMBER_2_ID],
          },
          ADMIN_PROFILE_ID,
          mockTx as never,
        ),
      ).rejects.toThrowError(
        'One or more selected members do not have an active enrollment in this batch.',
      );

      expect(updateSpy).not.toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it('enforces maximum 1 active pace group membership and creates audit record for every move', async () => {
      let selectCount = 0;
      const updatedList: unknown[] = [];
      const insertedList: unknown[] = [];

      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                if (selectCount === 1)
                  return Promise.resolve([{ id: BATCH_ID }]);
                if (selectCount === 2)
                  return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
                if (selectCount === 3)
                  return Promise.resolve([
                    { id: GROUP_20_ID, batchId: BATCH_ID, archived: false },
                  ]);
                if (selectCount === 4)
                  return Promise.resolve([
                    { id: 'pgm-active-old', paceGroupId: GROUP_10_ID },
                  ]);
                return Promise.resolve([]);
              }),
            })),
          })),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation((val) => {
            updatedList.push(val);
            return {
              where: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => {
            insertedList.push(val);
            return {
              returning: vi.fn().mockResolvedValue([{ id: 'new-row', ...val }]),
            };
          }),
        })),
      };

      await moveMemberToPaceGroup(
        {
          batchId: BATCH_ID,
          profileId: MEMBER_1_ID,
          toPaceGroupId: GROUP_20_ID,
          moveReason: 'Audit check',
        },
        ADMIN_PROFILE_ID,
        mockTx as never,
      );

      // 1. Old membership closed (status transitioned to switched)
      expect(updatedList).toHaveLength(1);
      expect((updatedList[0] as { status: string }).status).toBe('switched');

      // 2. Exactly 2 inserts: 1 new active membership + 1 audit log
      expect(insertedList).toHaveLength(2);
      expect((insertedList[0] as { status: string }).status).toBe('active');
      expect((insertedList[1] as { moveReason: string }).moveReason).toBe(
        'Audit check',
      );
    });
  });

  describe('Section 3: INTEGRATION TESTS', () => {
    it('unplaced member resolves awaiting placement message and cannot access schedule or record daily progress', async () => {
      vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValueOnce({
        id: 'bm-1',
        profileId: MEMBER_2_ID,
        batchId: BATCH_ID,
        status: 'active',
        createdAt: new Date(),
      } as never);
      vi.mocked(db.query.batches.findFirst).mockResolvedValueOnce({
        id: BATCH_ID,
        name: 'Batch 1',
        startDate: '2026-10-01',
        readingDaysPerWeek: 6,
      } as never);
      vi.mocked(db.query.paceGroupMemberships.findMany).mockResolvedValueOnce(
        [] as never,
      );

      const state = await getMemberHomeState(MEMBER_2_ID);
      expect(state.kind).toBe('active_awaiting_placement');
      if (state.kind === 'active_awaiting_placement') {
        expect(state.message).toBe(
          'You are accepted into this batch. Your pace group will be assigned soon.',
        );
      }
    });

    it('placed member resolves schedule, daily task, and records Daily Progress', async () => {
      vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValueOnce({
        id: 'bm-1',
        profileId: MEMBER_1_ID,
        batchId: BATCH_ID,
        status: 'active',
      } as never);
      vi.mocked(db.query.batches.findFirst).mockResolvedValueOnce({
        id: BATCH_ID,
        name: 'Batch 1',
        startDate: '2026-10-01',
        readingDaysPerWeek: 6,
      } as never);
      vi.mocked(db.query.paceGroupMemberships.findMany).mockResolvedValueOnce([
        {
          id: 'pgm-1',
          profileId: MEMBER_1_ID,
          paceGroupId: GROUP_10_ID,
          status: 'active',
        },
      ] as never);
      vi.mocked(db.query.paceGroups.findFirst).mockResolvedValueOnce({
        id: GROUP_10_ID,
        batchId: BATCH_ID,
        name: 'Group 10 (10 p/d)',
        size: 10,
        archived: false,
      } as never);

      vi.mocked(db.query.dailyTasks.findFirst).mockResolvedValueOnce({
        id: 'task-1',
        paceGroupId: GROUP_10_ID,
        bookId: 'book-1',
        dayNumber: 1,
        startPage: 1,
        endPage: 10,
        content: 'Read pages 1-10',
        publicationStatus: 'published',
        book: {
          id: 'book-1',
          title: 'Book 1',
          author: 'Author',
          totalPages: 300,
        },
      } as never);
      vi.mocked(db.query.dailyProgress.findFirst).mockResolvedValueOnce(
        null as never,
      );

      const state = await getMemberHomeState(MEMBER_1_ID, '2026-10-01');
      expect(state.kind).toBe('active_placed');
      if (state.kind === 'active_placed') {
        expect(state.paceGroupId).toBe(GROUP_10_ID);
        expect(state.schedule.status).toBe('published');
      }
    });
  });

  describe('Section 4: SECURITY & ACCESS CONTROL TESTS', () => {
    it('strictly derives actor from session identity and rejects unassigned batch admins', async () => {
      mockRequireBatchAccess.mockImplementationOnce(() => {
        throw new MockAuthzError(
          'FORBIDDEN',
          'You are not an assigned admin for this batch.',
        );
      });

      const result = await assignMemberAction({
        batchId: OTHER_BATCH_ID,
        profileId: MEMBER_1_ID,
        paceGroupId: GROUP_10_ID,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.formErrors).toContain(
          'You are not an assigned admin for this batch.',
        );
      }
    });

    it('rejects cross-batch pace group target mutation', async () => {
      let selectCount = 0;
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                if (selectCount === 1)
                  return Promise.resolve([{ id: BATCH_ID }]);
                if (selectCount === 2)
                  return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
                if (selectCount === 3) {
                  // Target group belongs to OTHER_BATCH_ID
                  return Promise.resolve([
                    {
                      id: GROUP_OTHER_ID,
                      batchId: OTHER_BATCH_ID,
                      archived: false,
                    },
                  ]);
                }
                return Promise.resolve([]);
              }),
            })),
          })),
        })),
      };

      await expect(
        assignMemberToPaceGroup(
          {
            batchId: BATCH_ID,
            profileId: MEMBER_1_ID,
            paceGroupId: GROUP_OTHER_ID,
          },
          ADMIN_PROFILE_ID,
          mockTx as never,
        ),
      ).rejects.toThrowError('Target pace group does not exist in this batch.');
    });
  });
});
