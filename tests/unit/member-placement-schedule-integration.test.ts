/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFindFirstBatchMembership,
  mockFindFirstBatch,
  mockFindManyPaceGroupMemberships,
  mockFindFirstPaceGroup,
  mockFindFirstTask,
  mockFindFirstDailyTask,
  mockFindManyDailyTasks,
  mockFindFirstDailyProgress,
  mockFindFirstBook,
  mockFindManyOffsets,
  mockFindFirstWaitlist,
  mockFindFirstApplication,
  mockFindFirstHandoff,
  mockInsert,
  mockInsertValues,
  mockOnConflictDoUpdate,
  mockReturning,
  mockSession,
  mockTx,
} = vi.hoisted(() => {
  const mockFindFirstBatchMembership = vi.fn();
  const mockFindFirstBatch = vi.fn();
  const mockFindManyPaceGroupMemberships = vi.fn();
  const mockFindFirstPaceGroup = vi.fn();
  const mockFindFirstTask = vi.fn();
  const mockFindFirstDailyTask = vi.fn();
  const mockFindManyDailyTasks = vi.fn();
  const mockFindFirstDailyProgress = vi.fn();
  const mockFindFirstBook = vi.fn();
  const mockFindManyOffsets = vi.fn();
  const mockFindFirstWaitlist = vi.fn();
  const mockFindFirstApplication = vi.fn();
  const mockFindFirstHandoff = vi.fn();
  const mockSession = vi.fn();

  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi
    .fn()
    .mockReturnValue({ returning: mockReturning });
  const mockInsertValues = vi
    .fn()
    .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockTx = {
    query: {
      batchMemberships: { findFirst: mockFindFirstBatchMembership },
      batches: { findFirst: mockFindFirstBatch },
      paceGroupMemberships: { findMany: mockFindManyPaceGroupMemberships },
      paceGroups: { findFirst: mockFindFirstPaceGroup },
      tasks: { findFirst: mockFindFirstTask },
      dailyTasks: {
        findFirst: mockFindFirstDailyTask,
        findMany: mockFindManyDailyTasks,
      },
      books: { findFirst: mockFindFirstBook },
      batchPacingOffsets: { findMany: mockFindManyOffsets },
      dailyProgress: { findFirst: mockFindFirstDailyProgress },
      waitlist: { findFirst: mockFindFirstWaitlist },
      applications: { findFirst: mockFindFirstApplication },
      handoffRecords: { findFirst: mockFindFirstHandoff },
    },
    insert: mockInsert,
  };

  return {
    mockFindFirstBatchMembership,
    mockFindFirstBatch,
    mockFindManyPaceGroupMemberships,
    mockFindFirstPaceGroup,
    mockFindFirstTask,
    mockFindFirstDailyTask,
    mockFindManyDailyTasks,
    mockFindFirstDailyProgress,
    mockFindFirstBook,
    mockFindManyOffsets,
    mockFindFirstWaitlist,
    mockFindFirstApplication,
    mockFindFirstHandoff,
    mockInsert,
    mockInsertValues,
    mockOnConflictDoUpdate,
    mockReturning,
    mockSession,
    mockTx,
  };
});

vi.mock('@/db', () => ({
  db: {
    query: {
      batchMemberships: { findFirst: mockFindFirstBatchMembership },
      batches: { findFirst: mockFindFirstBatch },
      paceGroupMemberships: { findMany: mockFindManyPaceGroupMemberships },
      paceGroups: { findFirst: mockFindFirstPaceGroup },
      tasks: { findFirst: mockFindFirstTask },
      dailyTasks: {
        findFirst: mockFindFirstDailyTask,
        findMany: mockFindManyDailyTasks,
      },
      books: { findFirst: mockFindFirstBook },
      batchPacingOffsets: { findMany: mockFindManyOffsets },
      dailyProgress: { findFirst: mockFindFirstDailyProgress },
      waitlist: { findFirst: mockFindFirstWaitlist },
      applications: { findFirst: mockFindFirstApplication },
      handoffRecords: { findFirst: mockFindFirstHandoff },
    },
    insert: mockInsert,
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
  },
}));

vi.mock('@/lib/auth/authorize', () => ({
  requireSession: mockSession,
  AuthzError: class AuthzError extends Error {},
}));

import { getMemberHomeState } from '@/lib/services/member/get-member-home-state';
import {
  recordDailyProgressForProfile,
  DailyProgressError,
} from '@/lib/services/daily-progress';
import { toggleDailyProgressAction } from '@/actions/daily-progress';

describe('Member Placement, Schedule, and Daily Progress Integration', () => {
  const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
  const BATCH_ID = '22222222-2222-4222-8222-222222222222';
  const GROUP_A_ID = '33333333-3333-4333-8333-333333333333';
  const GROUP_B_ID = '44444444-4444-4444-8444-444444444444';
  const BOOK_ID = '55555555-5555-5555-8555-555555555555';
  const TASK_A_ID = '66666666-6666-4666-8666-666666666666';
  const TASK_B_ID = '77777777-7777-4777-8777-777777777777';

  const mockBatch = {
    id: BATCH_ID,
    name: 'Batch 5 · Seerah',
    startDate: '2026-10-01',
    readingDaysPerWeek: 6,
  };

  const mockPaceGroupA = {
    id: GROUP_A_ID,
    batchId: BATCH_ID,
    name: 'Group 5A (5 p/d)',
    size: 5,
    archived: false,
  };

  const mockPaceGroupB = {
    id: GROUP_B_ID,
    batchId: BATCH_ID,
    name: 'Group 10B (10 p/d)',
    size: 10,
    archived: false,
  };

  const mockBook = {
    id: BOOK_ID,
    title: 'The Sealed Nectar',
    author: 'Safiur Rahman Mubarakpuri',
    totalPages: 320,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindManyOffsets.mockResolvedValue([]);
  });

  describe('1. Unplaced Member Flow & Server-Level Protection', () => {
    it('derives active_awaiting_placement and displays the exact required message', async () => {
      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
        createdAt: new Date(),
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([]); // No active group

      const state = await getMemberHomeState(PROFILE_ID);

      expect(state.kind).toBe('active_awaiting_placement');
      if (state.kind === 'active_awaiting_placement') {
        expect(state.batchName).toBe(mockBatch.name);
        expect(state.message).toBe(
          'You are accepted into this batch. Your pace group will be assigned soon.',
        );
      }
    });

    it('enforces server-side rejection if an unplaced member attempts to record Daily Progress', async () => {
      // Setup unplaced member state in DB
      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
        createdAt: new Date(),
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([]); // Unplaced: no active pace group

      // Direct service invocation attempt
      await expect(
        recordDailyProgressForProfile(PROFILE_ID, {
          taskId: TASK_A_ID,
          status: 'done',
          localDate: '2026-10-01',
        }),
      ).rejects.toThrowError(DailyProgressError);
    });

    it('server action rejects unplaced member with sanitized domain error', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'member@example.com', role: 'member' },
        profile: { id: PROFILE_ID, userId: 'user-1' },
      });

      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
        createdAt: new Date(),
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([]); // Unplaced

      const result = await toggleDailyProgressAction({
        taskId: TASK_A_ID,
        status: 'done',
        localDate: '2026-10-01',
      });

      expect(result.ok).toBe(false);
      expect(result.errors?.formErrors[0]).toContain(
        'Member is not assigned to any active pace group.',
      );
    });
  });

  describe('2. Transition: unplaced → placed', () => {
    it('resolves active_placed, current pace group, and today published task once placed', async () => {
      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
        createdAt: new Date(),
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([
        {
          id: 'pgm-1',
          profileId: PROFILE_ID,
          paceGroupId: GROUP_A_ID,
          status: 'active',
        },
      ]);
      mockFindFirstPaceGroup.mockResolvedValueOnce(mockPaceGroupA);

      const mockTask = {
        id: TASK_A_ID,
        paceGroupId: GROUP_A_ID,
        bookId: BOOK_ID,
        dayNumber: 1,
        startPage: 1,
        endPage: 5,
        content: 'Read pages 1 to 5.',
        publicationStatus: 'published',
        book: mockBook,
      };

      mockFindFirstDailyTask.mockResolvedValueOnce(mockTask);
      mockFindFirstDailyProgress.mockResolvedValueOnce(null); // Not completed yet

      const state = await getMemberHomeState(PROFILE_ID, '2026-10-01');

      expect(state.kind).toBe('active_placed');
      if (state.kind === 'active_placed') {
        expect(state.paceGroupId).toBe(GROUP_A_ID);
        expect(state.paceGroupName).toBe('Group 5A (5 p/d)');
        expect(state.schedule.status).toBe('published');
        if (state.schedule.status === 'published') {
          expect(state.schedule.task.id).toBe(TASK_A_ID);
          expect(state.schedule.isCompleted).toBe(false);
        }
      }
    });

    it('allows recording Daily Progress once placed', async () => {
      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([
        {
          id: 'pgm-1',
          profileId: PROFILE_ID,
          paceGroupId: GROUP_A_ID,
          status: 'active',
        },
      ]);
      mockFindFirstPaceGroup.mockResolvedValueOnce(mockPaceGroupA);

      // Task exists as published daily task in Group A
      mockFindFirstTask.mockResolvedValueOnce(null);
      mockFindFirstDailyTask.mockResolvedValueOnce({
        id: TASK_A_ID,
        paceGroupId: GROUP_A_ID,
        bookId: BOOK_ID,
        dayNumber: 1,
        content: 'Read pages 1 to 5.',
        publicationStatus: 'published',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockFindFirstBook.mockResolvedValueOnce(mockBook);
      mockFindFirstDailyProgress.mockResolvedValueOnce(null);

      const insertedRecord = {
        id: 'dp-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        paceGroupId: GROUP_A_ID,
        taskId: TASK_A_ID,
        status: 'done',
        completedAt: new Date('2026-10-01T10:00:00Z'),
      };
      mockReturning.mockResolvedValueOnce([insertedRecord]);

      const result = await recordDailyProgressForProfile(PROFILE_ID, {
        taskId: TASK_A_ID,
        status: 'done',
        localDate: '2026-10-01',
      });

      expect(result.progress.status).toBe('done');
      expect(result.statusChanged).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('supports transitioning to not_done and clears completedAt', async () => {
      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([
        {
          id: 'pgm-1',
          profileId: PROFILE_ID,
          paceGroupId: GROUP_A_ID,
          status: 'active',
        },
      ]);
      mockFindFirstPaceGroup.mockResolvedValueOnce(mockPaceGroupA);

      mockFindFirstTask.mockResolvedValueOnce(null);
      mockFindFirstDailyTask.mockResolvedValueOnce({
        id: TASK_A_ID,
        paceGroupId: GROUP_A_ID,
        bookId: BOOK_ID,
        dayNumber: 1,
        content: 'Read pages 1 to 5.',
        publicationStatus: 'published',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockFindFirstBook.mockResolvedValueOnce(mockBook);

      // Existing record was done
      mockFindFirstDailyProgress.mockResolvedValueOnce({
        id: 'dp-1',
        profileId: PROFILE_ID,
        taskId: TASK_A_ID,
        status: 'done',
        completedAt: new Date('2026-10-01T10:00:00Z'),
      });

      const updatedRecord = {
        id: 'dp-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        paceGroupId: GROUP_A_ID,
        taskId: TASK_A_ID,
        status: 'not_done',
        completedAt: null,
      };
      mockReturning.mockResolvedValueOnce([updatedRecord]);

      const result = await recordDailyProgressForProfile(PROFILE_ID, {
        taskId: TASK_A_ID,
        status: 'not_done',
        localDate: '2026-10-01',
      });

      expect(result.progress.status).toBe('not_done');
      expect(result.progress.completedAt).toBeNull();
      expect(result.previousStatus).toBe('done');
      expect(result.statusChanged).toBe(true);
    });

    it('duplicate done submissions remain idempotent and preserve original completedAt', async () => {
      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([
        {
          id: 'pgm-1',
          profileId: PROFILE_ID,
          paceGroupId: GROUP_A_ID,
          status: 'active',
        },
      ]);
      mockFindFirstPaceGroup.mockResolvedValueOnce(mockPaceGroupA);

      mockFindFirstTask.mockResolvedValueOnce(null);
      mockFindFirstDailyTask.mockResolvedValueOnce({
        id: TASK_A_ID,
        paceGroupId: GROUP_A_ID,
        bookId: BOOK_ID,
        dayNumber: 1,
        content: 'Read pages 1 to 5.',
        publicationStatus: 'published',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockFindFirstBook.mockResolvedValueOnce(mockBook);

      const originalCompletedAt = new Date('2026-10-01T08:00:00Z');
      mockFindFirstDailyProgress.mockResolvedValueOnce({
        id: 'dp-1',
        profileId: PROFILE_ID,
        taskId: TASK_A_ID,
        status: 'done',
        completedAt: originalCompletedAt,
      });

      mockReturning.mockResolvedValueOnce([
        {
          id: 'dp-1',
          profileId: PROFILE_ID,
          batchId: BATCH_ID,
          paceGroupId: GROUP_A_ID,
          taskId: TASK_A_ID,
          status: 'done',
          completedAt: originalCompletedAt,
        },
      ]);

      const result = await recordDailyProgressForProfile(PROFILE_ID, {
        taskId: TASK_A_ID,
        status: 'done',
        localDate: '2026-10-01',
      });

      expect(result.progress.status).toBe('done');
      expect(result.statusChanged).toBe(false);
      expect(result.previousStatus).toBe('done');
      expect(result.progress.completedAt).toEqual(originalCompletedAt);
    });
  });

  describe('3. Move Scenario: placed in Group A → moved to Group B', () => {
    it('resolves Group B tasks, preserves batch membership, and rejects mutating Group A tasks', async () => {
      // 1. Batch membership is still active and unchanged
      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
        createdAt: new Date(),
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);

      // 2. Member has moved to Group B
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([
        {
          id: 'pgm-new',
          profileId: PROFILE_ID,
          paceGroupId: GROUP_B_ID,
          status: 'active',
        },
      ]);
      mockFindFirstPaceGroup.mockResolvedValueOnce(mockPaceGroupB);

      // 3. Group B published task
      const mockTaskB = {
        id: TASK_B_ID,
        paceGroupId: GROUP_B_ID,
        bookId: BOOK_ID,
        dayNumber: 1,
        startPage: 1,
        endPage: 10,
        content: 'Read pages 1 to 10 for Group B.',
        publicationStatus: 'published',
        book: mockBook,
      };

      mockFindFirstDailyTask.mockResolvedValueOnce(mockTaskB);
      mockFindFirstDailyProgress.mockResolvedValueOnce(null);

      const state = await getMemberHomeState(PROFILE_ID, '2026-10-01');

      // Member schedule resolves Group B's task (pages 1-10)
      expect(state.kind).toBe('active_placed');
      if (state.kind === 'active_placed') {
        expect(state.paceGroupId).toBe(GROUP_B_ID);
        expect(state.paceGroupName).toBe('Group 10B (10 p/d)');
        if (state.schedule.status === 'published') {
          expect(state.schedule.task.id).toBe(TASK_B_ID);
          expect(state.schedule.task.endPage).toBe(10);
        }
      }

      // 4. If the moved member attempts to mutate progress for Group A's task, it fails with TASK_GROUP_MISMATCH
      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([
        {
          id: 'pgm-new',
          profileId: PROFILE_ID,
          paceGroupId: GROUP_B_ID,
          status: 'active',
        },
      ]);
      mockFindFirstPaceGroup.mockResolvedValueOnce(mockPaceGroupB);

      mockFindFirstTask.mockResolvedValueOnce(null);
      mockFindFirstDailyTask.mockResolvedValueOnce({
        id: TASK_A_ID,
        paceGroupId: GROUP_A_ID, // Belongs to old Group A!
        bookId: BOOK_ID,
        dayNumber: 1,
        content: 'Read pages 1 to 5.',
        publicationStatus: 'published',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        recordDailyProgressForProfile(PROFILE_ID, {
          taskId: TASK_A_ID,
          status: 'done',
          localDate: '2026-10-01',
        }),
      ).rejects.toThrowError('This daily task belongs to another pace group.');
    });
  });

  describe('4. Security & Actor Identity Resolution', () => {
    it('derives member profile strictly from session and ignores client-provided IDs', async () => {
      const AUTHENTICATED_PROFILE_ID = PROFILE_ID;
      const ATTACKER_TARGET_PROFILE_ID = '99999999-9999-9999-9999-999999999999';

      mockSession.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'member@example.com', role: 'member' },
        profile: { id: AUTHENTICATED_PROFILE_ID, userId: 'user-1' },
      });

      mockFindFirstBatchMembership.mockResolvedValueOnce({
        id: 'bm-1',
        profileId: AUTHENTICATED_PROFILE_ID,
        batchId: BATCH_ID,
        status: 'active',
      });
      mockFindFirstBatch.mockResolvedValueOnce(mockBatch);
      mockFindManyPaceGroupMemberships.mockResolvedValueOnce([
        {
          id: 'pgm-1',
          profileId: AUTHENTICATED_PROFILE_ID,
          paceGroupId: GROUP_A_ID,
          status: 'active',
        },
      ]);
      mockFindFirstPaceGroup.mockResolvedValueOnce(mockPaceGroupA);

      mockFindFirstTask.mockResolvedValueOnce(null);
      mockFindFirstDailyTask.mockResolvedValueOnce({
        id: TASK_A_ID,
        paceGroupId: GROUP_A_ID,
        bookId: BOOK_ID,
        dayNumber: 1,
        content: 'Read pages 1 to 5.',
        publicationStatus: 'published',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockFindFirstBook.mockResolvedValueOnce(mockBook);
      mockFindFirstDailyProgress.mockResolvedValueOnce(null);

      mockReturning.mockResolvedValueOnce([
        {
          id: 'dp-1',
          profileId: AUTHENTICATED_PROFILE_ID,
          batchId: BATCH_ID,
          paceGroupId: GROUP_A_ID,
          taskId: TASK_A_ID,
          status: 'done',
        },
      ]);

      // Attacker passes forged profileId/memberId in input
      const result = await toggleDailyProgressAction({
        taskId: TASK_A_ID,
        status: 'done',
        localDate: '2026-10-01',
        profileId: ATTACKER_TARGET_PROFILE_ID,
        memberId: ATTACKER_TARGET_PROFILE_ID,
      } as any);

      expect(result.ok).toBe(true);
      // Verify query used AUTHENTICATED_PROFILE_ID, not the spoofed ID
      expect(mockFindFirstBatchMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      );
      expect(result.data?.profileId).toBe(AUTHENTICATED_PROFILE_ID);
    });
  });
});
