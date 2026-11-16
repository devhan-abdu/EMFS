import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// Mock DB
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    query: {
      batches: { findFirst: vi.fn() },
      paceGroups: { findMany: vi.fn(), findFirst: vi.fn() },
      batchBreaks: { findMany: vi.fn(), findFirst: vi.fn() },
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Hoist AuthzError and mocks
const { AuthzErrorClass, mockRequireBatchAccess, mockRequirePaceGroupAccess } =
  vi.hoisted(() => {
    class AuthzError extends Error {
      code: string;
      constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN', message: string) {
        super(message);
        this.name = 'AuthzError';
        this.code = code;
      }
    }

    return {
      AuthzErrorClass: AuthzError,
      mockRequireBatchAccess: vi.fn(),
      mockRequirePaceGroupAccess: vi.fn(),
    };
  });

vi.mock('@/lib/auth/authorize', () => ({
  AuthzError: AuthzErrorClass,
  requireBatchAccess: (...args: unknown[]) => mockRequireBatchAccess(...args),
  requirePaceGroupAccess: (...args: unknown[]) =>
    mockRequirePaceGroupAccess(...args),
}));

import {
  saveScheduleSettingsAction,
  resetPaceGroupScheduleAction,
  createBatchBreakAction,
  deleteBatchBreakAction,
} from '@/actions/batch-settings';
import {
  getPaceGroupOverride,
  hasPaceGroupOverride,
  clearAllPaceGroupOverrides,
} from '@/lib/services/batches/batch-schedule-overrides';

const BATCH_ID = '11111111-1111-4111-8111-111111111111';
const GROUP_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GROUP_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BREAK_BATCH_ID = '99999999-9999-4999-8999-999999999999';
const BREAK_GROUP_ID = '88888888-8888-4888-8888-888888888888';

const BATCH_ADMIN_USER = {
  authUserId: 'admin-1',
  email: 'admin@example.com',
  profile: { id: 'prof-admin', isSuperAdmin: false },
};

const PACE_ADMIN_A_USER = {
  authUserId: 'pace-a',
  email: 'pacea@example.com',
  profile: { id: 'prof-pace-a', isSuperAdmin: false },
};

describe('EMF-88 Settings & Offsets Backend & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllPaceGroupOverrides();

    // Default mock behavior for update
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: BATCH_ID }]),
      }),
    });

    // Default mock behavior for insert
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: BREAK_BATCH_ID,
            batchId: BATCH_ID,
            paceGroupId: null,
            title: 'Test Break',
            startDate: '2026-12-20',
            endDate: '2026-12-25',
          },
        ]),
      }),
    });

    // Default mock behavior for delete
    mockDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: BREAK_BATCH_ID }]),
      }),
    });
  });

  describe('1. Batch Admin Flow (Batch Default, Group Override, and Break Management)', () => {
    it('sets the batch default schedule when paceGroupId is not provided', async () => {
      mockRequireBatchAccess.mockResolvedValueOnce(BATCH_ADMIN_USER);

      const formData = new FormData();
      formData.append('batchId', BATCH_ID);
      formData.append('readingDaysPerWeek', '5');
      formData.append('readingDays', 'mon');
      formData.append('readingDays', 'tue');
      formData.append('readingDays', 'wed');
      formData.append('readingDays', 'thu');
      formData.append('readingDays', 'fri');
      formData.append('attendanceDay', 'wed');
      formData.append('attendanceTime', '19:30');

      const result = await saveScheduleSettingsAction(null, formData);

      expect(mockRequireBatchAccess).toHaveBeenCalledWith(BATCH_ID);
      expect(result).not.toBeNull();
      expect(result?.ok).toBe(true);
      expect(result?.data?.scope).toBe('batch');
      expect(result?.data?.readingDaysPerWeek).toBe(5);
      expect(result?.data?.attendanceDay).toBe('wed');
      expect(result?.data?.attendanceTime).toBe('19:30');
    });

    it('sets a custom override for a specific pace group', async () => {
      mockRequirePaceGroupAccess.mockResolvedValueOnce(BATCH_ADMIN_USER);

      const formData = new FormData();
      formData.append('batchId', BATCH_ID);
      formData.append('paceGroupId', GROUP_A_ID);
      formData.append('readingDaysPerWeek', '4');
      formData.append('readingDays', 'mon');
      formData.append('readingDays', 'tue');
      formData.append('readingDays', 'wed');
      formData.append('readingDays', 'thu');
      formData.append('attendanceDay', 'mon');
      formData.append('attendanceTime', '20:00');

      const result = await saveScheduleSettingsAction(null, formData);

      expect(mockRequirePaceGroupAccess).toHaveBeenCalledWith(GROUP_A_ID);
      expect(result?.ok).toBe(true);
      expect(result?.data?.scope).toBe('group');
      expect(result?.data?.paceGroupId).toBe(GROUP_A_ID);
      expect(hasPaceGroupOverride(GROUP_A_ID)).toBe(true);

      const override = getPaceGroupOverride(GROUP_A_ID);
      expect(override?.readingDaysPerWeek).toBe(4);
      expect(override?.attendanceDay).toBe('mon');
      expect(override?.attendanceTime).toBe('20:00');
    });

    it('creates both a "Whole batch" break and a group-specific break', async () => {
      // 1. Whole batch break
      mockRequireBatchAccess.mockResolvedValueOnce(BATCH_ADMIN_USER);

      const batchBreakForm = new FormData();
      batchBreakForm.append('batchId', BATCH_ID);
      batchBreakForm.append('title', 'Holiday Pause');
      batchBreakForm.append('startDate', '2026-12-24');
      batchBreakForm.append('endDate', '2026-12-28');

      const batchBreakResult = await createBatchBreakAction(
        null,
        batchBreakForm,
      );
      expect(mockRequireBatchAccess).toHaveBeenCalledWith(BATCH_ID);
      expect(batchBreakResult?.ok).toBe(true);

      // 2. Group break
      mockRequirePaceGroupAccess.mockResolvedValueOnce(BATCH_ADMIN_USER);
      mockInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: BREAK_GROUP_ID,
              batchId: BATCH_ID,
              paceGroupId: GROUP_A_ID,
              title: 'Group A Sprint Pause',
              startDate: '2026-12-15',
              endDate: '2026-12-16',
            },
          ]),
        }),
      });

      const groupBreakForm = new FormData();
      groupBreakForm.append('batchId', BATCH_ID);
      groupBreakForm.append('paceGroupId', GROUP_A_ID);
      groupBreakForm.append('title', 'Group A Sprint Pause');
      groupBreakForm.append('startDate', '2026-12-15');
      groupBreakForm.append('endDate', '2026-12-16');

      const groupBreakResult = await createBatchBreakAction(
        null,
        groupBreakForm,
      );
      expect(mockRequirePaceGroupAccess).toHaveBeenCalledWith(GROUP_A_ID);
      expect(groupBreakResult?.ok).toBe(true);
      expect(groupBreakResult?.data?.paceGroupId).toBe(GROUP_A_ID);
    });
  });

  describe('2. Pace Admin Security & Isolation (D2-3a)', () => {
    it('permits pace admin to edit their assigned pace group override', async () => {
      mockRequirePaceGroupAccess.mockResolvedValueOnce(PACE_ADMIN_A_USER);

      const formData = new FormData();
      formData.append('batchId', BATCH_ID);
      formData.append('paceGroupId', GROUP_A_ID);
      formData.append('readingDaysPerWeek', '6');
      formData.append('readingDays', 'mon');
      formData.append('readingDays', 'tue');
      formData.append('readingDays', 'wed');
      formData.append('readingDays', 'thu');
      formData.append('readingDays', 'fri');
      formData.append('readingDays', 'sat');
      formData.append('attendanceDay', 'thu');
      formData.append('attendanceTime', '21:00');

      const result = await saveScheduleSettingsAction(null, formData);

      expect(mockRequirePaceGroupAccess).toHaveBeenCalledWith(GROUP_A_ID);
      expect(result?.ok).toBe(true);
      expect(result?.data?.paceGroupId).toBe(GROUP_A_ID);
    });

    it('rejects pace admin attempting to modify batch default', async () => {
      mockRequireBatchAccess.mockRejectedValueOnce(
        new AuthzErrorClass(
          'FORBIDDEN',
          'You are not an assigned admin for this batch.',
        ),
      );

      const formData = new FormData();
      formData.append('batchId', BATCH_ID);
      // paceGroupId omitted -> targets batch default!
      formData.append('readingDaysPerWeek', '3');

      const result = await saveScheduleSettingsAction(null, formData);

      expect(result?.ok).toBe(false);
      expect(result?.errors?.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    });

    it('rejects pace admin attempting to modify another pace group', async () => {
      mockRequirePaceGroupAccess.mockRejectedValueOnce(
        new AuthzErrorClass(
          'FORBIDDEN',
          'You are not assigned to this batch or pace group.',
        ),
      );

      const formData = new FormData();
      formData.append('batchId', BATCH_ID);
      formData.append('paceGroupId', GROUP_B_ID); // Admin A trying to edit Group B!
      formData.append('readingDaysPerWeek', '3');

      const result = await saveScheduleSettingsAction(null, formData);

      expect(mockRequirePaceGroupAccess).toHaveBeenCalledWith(GROUP_B_ID);
      expect(result?.ok).toBe(false);
      expect(result?.errors?.formErrors).toContain(
        'You are not assigned to this batch or pace group.',
      );
    });

    it('rejects pace admin attempting to create a "Whole batch" break', async () => {
      mockRequireBatchAccess.mockRejectedValueOnce(
        new AuthzErrorClass(
          'FORBIDDEN',
          'You are not an assigned admin for this batch.',
        ),
      );

      const formData = new FormData();
      formData.append('batchId', BATCH_ID);
      // paceGroupId omitted -> "Whole batch"
      formData.append('title', 'Unauthorized Batch Pause');
      formData.append('startDate', '2026-12-01');
      formData.append('endDate', '2026-12-05');

      const result = await createBatchBreakAction(null, formData);

      expect(result?.ok).toBe(false);
      expect(result?.errors?.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    });

    it('rejects pace admin attempting to delete a "Whole batch" break', async () => {
      // Mock select finding a whole batch break (paceGroupId: null)
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: BREAK_BATCH_ID,
                batchId: BATCH_ID,
                paceGroupId: null, // Whole batch break
                title: 'Global Break',
              },
            ]),
          }),
        }),
      });

      mockRequireBatchAccess.mockRejectedValueOnce(
        new AuthzErrorClass(
          'FORBIDDEN',
          'You are not an assigned admin for this batch.',
        ),
      );

      const formData = new FormData();
      formData.append('breakId', BREAK_BATCH_ID);
      formData.append('batchId', BATCH_ID);

      const result = await deleteBatchBreakAction(null, formData);

      expect(mockRequireBatchAccess).toHaveBeenCalledWith(BATCH_ID);
      expect(result?.ok).toBe(false);
      expect(result?.errors?.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    });

    it("rejects pace admin attempting to delete another group's break", async () => {
      // Mock select finding a break belonging to Group B
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: BREAK_GROUP_ID,
                batchId: BATCH_ID,
                paceGroupId: GROUP_B_ID,
                title: 'Group B Break',
              },
            ]),
          }),
        }),
      });

      mockRequirePaceGroupAccess.mockRejectedValueOnce(
        new AuthzErrorClass(
          'FORBIDDEN',
          'You are not assigned to this batch or pace group.',
        ),
      );

      const formData = new FormData();
      formData.append('breakId', BREAK_GROUP_ID);
      formData.append('batchId', BATCH_ID);

      const result = await deleteBatchBreakAction(null, formData);

      expect(mockRequirePaceGroupAccess).toHaveBeenCalledWith(GROUP_B_ID);
      expect(result?.ok).toBe(false);
      expect(result?.errors?.formErrors).toContain(
        'You are not assigned to this batch or pace group.',
      );
    });
  });

  describe('3. Override Reset Behavior', () => {
    it('cleanly resets an existing pace group override', async () => {
      mockRequirePaceGroupAccess.mockResolvedValue(PACE_ADMIN_A_USER);

      // First create override
      const createForm = new FormData();
      createForm.append('batchId', BATCH_ID);
      createForm.append('paceGroupId', GROUP_A_ID);
      createForm.append('readingDaysPerWeek', '3');
      createForm.append('readingDays', 'mon');
      createForm.append('readingDays', 'wed');
      createForm.append('readingDays', 'fri');

      await saveScheduleSettingsAction(null, createForm);
      expect(hasPaceGroupOverride(GROUP_A_ID)).toBe(true);

      // Now reset it
      const resetForm = new FormData();
      resetForm.append('batchId', BATCH_ID);
      resetForm.append('paceGroupId', GROUP_A_ID);

      const resetResult = await resetPaceGroupScheduleAction(null, resetForm);

      expect(mockRequirePaceGroupAccess).toHaveBeenCalledWith(GROUP_A_ID);
      expect(resetResult?.ok).toBe(true);
      expect(hasPaceGroupOverride(GROUP_A_ID)).toBe(false);
      expect(getPaceGroupOverride(GROUP_A_ID)).toBeNull();
    });
  });
});
