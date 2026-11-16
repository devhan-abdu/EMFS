import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// State for mock database
let batchStore: {
  id: string;
  maxMembers: number;
  registrationOpen: boolean;
};
let adminsStore: { batchId: string; profileId: string }[];
let paceGroupsStore: { id: string; batchId: string; archived: boolean }[];
let membershipsStore: { id: string; batchId: string; status: string }[];

const mockUpdateFn = vi.fn();

const BATCH_ID = 'batch-83-uuid';

// Hoist mock functions for `@/db`
const { mockDbSelect, mockDbUpdate } = vi.hoisted(() => {
  const mockDbSelect = vi.fn();
  const mockDbUpdate = vi.fn();
  return { mockDbSelect, mockDbUpdate };
});

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock('@/lib/auth/authorize', () => ({
  requireBatchAccess: vi.fn().mockResolvedValue({
    user: { id: 'user-1' },
    profile: { id: 'admin-1', role: 'batch_admin' },
  }),
  AuthzError: class AuthzError extends Error {
    code = 'FORBIDDEN';
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  validateBatchRegistrationGate,
  updateBatchRegistration,
  BatchError,
  type DbOrTx,
} from '@/lib/services/batches/batch';
import { toggleRegistrationAction } from '@/actions/batch-toggle';

describe('EMF-83 Registration Gate Validation', () => {
  // Build a test executor that mimics Drizzle's query interface
  const createMockExecutor = () => ({
    select: vi
      .fn()
      .mockImplementation((selection?: Record<string, unknown>) => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            // Identify table by selection or context
            if (selection && 'adminCount' in selection) {
              const count = adminsStore.filter(
                (a) => a.batchId === BATCH_ID,
              ).length;
              return Promise.resolve([{ adminCount: count, count }]);
            }
            if (selection && 'paceGroupCount' in selection) {
              const count = paceGroupsStore.filter(
                (pg) => pg.batchId === BATCH_ID && !pg.archived,
              ).length;
              return Promise.resolve([{ paceGroupCount: count, count }]);
            }
            if (selection && 'memberCount' in selection) {
              const count = membershipsStore.filter(
                (m) =>
                  m.batchId === BATCH_ID &&
                  ['approved', 'active', 'grace'].includes(m.status),
              ).length;
              return Promise.resolve([{ memberCount: count, count }]);
            }
            // Default to querying batches
            if (batchStore && batchStore.id === BATCH_ID) {
              return Promise.resolve([batchStore]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
    update: vi.fn().mockImplementation(() => ({
      set: vi
        .fn()
        .mockImplementation((setValues: { registrationOpen?: boolean }) => ({
          where: vi.fn().mockImplementation(() => {
            mockUpdateFn(setValues);
            if (typeof setValues.registrationOpen === 'boolean') {
              batchStore.registrationOpen = setValues.registrationOpen;
            }
            return {
              returning: () => Promise.resolve([batchStore]),
              then: (resolve: (val: unknown) => void) => resolve([batchStore]),
            };
          }),
        })),
    })),
  });

  let mockExecutor: ReturnType<typeof createMockExecutor>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateFn.mockClear();

    // Default baseline state: all conditions fulfilled
    batchStore = {
      id: BATCH_ID,
      maxMembers: 10,
      registrationOpen: false,
    };
    adminsStore = [{ batchId: BATCH_ID, profileId: 'admin-1' }];
    paceGroupsStore = [{ id: 'pg-1', batchId: BATCH_ID, archived: false }];
    membershipsStore = [
      { id: 'm-1', batchId: BATCH_ID, status: 'active' },
      { id: 'm-2', batchId: BATCH_ID, status: 'approved' },
    ];

    mockExecutor = createMockExecutor();

    // Wire up global db mocks
    mockDbSelect.mockImplementation((...args: unknown[]) =>
      mockExecutor.select(...(args as Parameters<typeof mockExecutor.select>)),
    );
    mockDbUpdate.mockImplementation((...args: unknown[]) =>
      mockExecutor.update(...(args as Parameters<typeof mockExecutor.update>)),
    );
  });

  describe('Condition 1: Batch Admin Check (NO_BATCH_ADMIN)', () => {
    it('throws NO_BATCH_ADMIN when batch has no assigned admins and leaves DB unchanged', async () => {
      // Breached condition 1: 0 admins
      adminsStore = [];

      await expect(
        validateBatchRegistrationGate(
          BATCH_ID,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toThrow(BatchError);

      await expect(
        updateBatchRegistration(
          BATCH_ID,
          true,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toMatchObject({
        code: 'NO_BATCH_ADMIN',
        message: 'NO_BATCH_ADMIN',
      });

      // Assert database write was never called and batch remains closed
      expect(mockUpdateFn).not.toHaveBeenCalled();
      expect(batchStore.registrationOpen).toBe(false);
    });

    it('passes Condition 1 when at least one batch admin is assigned', async () => {
      adminsStore = [{ batchId: BATCH_ID, profileId: 'admin-1' }];

      // Should not throw NO_BATCH_ADMIN
      await expect(
        validateBatchRegistrationGate(
          BATCH_ID,
          mockExecutor as unknown as DbOrTx,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('Condition 2: Non-Archived Pace Group Check (NO_PACE_GROUP)', () => {
    it('throws NO_PACE_GROUP when batch has zero pace groups and leaves DB unchanged', async () => {
      // Breached condition 2: 0 pace groups
      paceGroupsStore = [];

      await expect(
        validateBatchRegistrationGate(
          BATCH_ID,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toThrow(BatchError);

      await expect(
        updateBatchRegistration(
          BATCH_ID,
          true,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toMatchObject({
        code: 'NO_PACE_GROUP',
        message: 'NO_PACE_GROUP',
      });

      // Assert database record remained unchanged
      expect(mockUpdateFn).not.toHaveBeenCalled();
      expect(batchStore.registrationOpen).toBe(false);
    });

    it('throws NO_PACE_GROUP when all pace groups in the batch are archived and leaves DB unchanged', async () => {
      // Breached condition 2: only archived pace groups
      paceGroupsStore = [
        { id: 'pg-1', batchId: BATCH_ID, archived: true },
        { id: 'pg-2', batchId: BATCH_ID, archived: true },
      ];

      await expect(
        validateBatchRegistrationGate(
          BATCH_ID,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toThrow(BatchError);

      await expect(
        updateBatchRegistration(
          BATCH_ID,
          true,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toMatchObject({
        code: 'NO_PACE_GROUP',
      });

      expect(mockUpdateFn).not.toHaveBeenCalled();
      expect(batchStore.registrationOpen).toBe(false);
    });

    it('passes Condition 2 when batch has at least one non-archived pace group', async () => {
      paceGroupsStore = [
        { id: 'pg-archived', batchId: BATCH_ID, archived: true },
        { id: 'pg-active', batchId: BATCH_ID, archived: false },
      ];

      await expect(
        validateBatchRegistrationGate(
          BATCH_ID,
          mockExecutor as unknown as DbOrTx,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('Condition 3: Batch Capacity Check (BATCH_FULL)', () => {
    it('throws BATCH_FULL when member count equals maxMembers and leaves DB unchanged', async () => {
      // Breached condition 3: exactly full (3 of 3)
      batchStore.maxMembers = 3;
      membershipsStore = [
        { id: 'm-1', batchId: BATCH_ID, status: 'active' },
        { id: 'm-2', batchId: BATCH_ID, status: 'approved' },
        { id: 'm-3', batchId: BATCH_ID, status: 'grace' },
      ];

      await expect(
        validateBatchRegistrationGate(
          BATCH_ID,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toThrow(BatchError);

      await expect(
        updateBatchRegistration(
          BATCH_ID,
          true,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toMatchObject({
        code: 'BATCH_FULL',
        message: 'BATCH_FULL',
      });

      // Assert database record remained unchanged
      expect(mockUpdateFn).not.toHaveBeenCalled();
      expect(batchStore.registrationOpen).toBe(false);
    });

    it('throws BATCH_FULL when member count exceeds maxMembers and leaves DB unchanged', async () => {
      // Breached condition 3: over capacity (4 of 3)
      batchStore.maxMembers = 3;
      membershipsStore = [
        { id: 'm-1', batchId: BATCH_ID, status: 'active' },
        { id: 'm-2', batchId: BATCH_ID, status: 'approved' },
        { id: 'm-3', batchId: BATCH_ID, status: 'grace' },
        { id: 'm-4', batchId: BATCH_ID, status: 'active' },
      ];

      await expect(
        validateBatchRegistrationGate(
          BATCH_ID,
          mockExecutor as unknown as DbOrTx,
        ),
      ).rejects.toMatchObject({
        code: 'BATCH_FULL',
      });

      expect(mockUpdateFn).not.toHaveBeenCalled();
      expect(batchStore.registrationOpen).toBe(false);
    });

    it('passes Condition 3 when enrolled members are strictly under capacity limit', async () => {
      batchStore.maxMembers = 10;
      membershipsStore = [
        { id: 'm-1', batchId: BATCH_ID, status: 'active' },
        { id: 'm-2', batchId: BATCH_ID, status: 'approved' },
        // Terminated statuses do not consume capacity
        { id: 'm-3', batchId: BATCH_ID, status: 'rejected' },
        { id: 'm-4', batchId: BATCH_ID, status: 'removed' },
      ];

      // 2 enrolled < 10 maxMembers -> passes
      await expect(
        validateBatchRegistrationGate(
          BATCH_ID,
          mockExecutor as unknown as DbOrTx,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('Perfect Success State', () => {
    it('successfully transitions registration_open to true when all 3 gate conditions are met', async () => {
      expect(batchStore.registrationOpen).toBe(false);

      const result = await updateBatchRegistration(
        BATCH_ID,
        true,
        mockExecutor as unknown as DbOrTx,
      );

      expect(result.registrationOpen).toBe(true);
      expect(mockUpdateFn).toHaveBeenCalledWith(
        expect.objectContaining({ registrationOpen: true }),
      );
      expect(batchStore.registrationOpen).toBe(true);
    });

    it('allows closing registration (open = false) without triggering gate checks', async () => {
      // Corrupt state where gate conditions would fail if opening:
      adminsStore = [];
      paceGroupsStore = [];
      batchStore.registrationOpen = true;

      // Closing registration must not be blocked by gate validation
      const result = await updateBatchRegistration(
        BATCH_ID,
        false,
        mockExecutor as unknown as DbOrTx,
      );

      expect(result.registrationOpen).toBe(false);
      expect(mockUpdateFn).toHaveBeenCalledWith(
        expect.objectContaining({ registrationOpen: false }),
      );
      expect(batchStore.registrationOpen).toBe(false);
    });
  });

  describe('Server Action Integration (toggleRegistrationAction)', () => {
    it('returns structured NO_BATCH_ADMIN error when Condition 1 fails and leaves DB unchanged', async () => {
      adminsStore = [];

      const res = await toggleRegistrationAction({
        batchId: BATCH_ID,
        open: true,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('NO_BATCH_ADMIN');
        expect(res.errors.formErrors).toContain('NO_BATCH_ADMIN');
      }
      expect(batchStore.registrationOpen).toBe(false);
    });

    it('returns structured NO_PACE_GROUP error when Condition 2 fails and leaves DB unchanged', async () => {
      paceGroupsStore = [];

      const res = await toggleRegistrationAction({
        batchId: BATCH_ID,
        open: true,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('NO_PACE_GROUP');
        expect(res.errors.formErrors).toContain('NO_PACE_GROUP');
      }
      expect(batchStore.registrationOpen).toBe(false);
    });

    it('returns structured BATCH_FULL error when Condition 3 fails and leaves DB unchanged', async () => {
      batchStore.maxMembers = 2;
      membershipsStore = [
        { id: 'm-1', batchId: BATCH_ID, status: 'active' },
        { id: 'm-2', batchId: BATCH_ID, status: 'active' },
      ];

      const res = await toggleRegistrationAction({
        batchId: BATCH_ID,
        open: true,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('BATCH_FULL');
        expect(res.errors.formErrors).toContain('BATCH_FULL');
      }
      expect(batchStore.registrationOpen).toBe(false);
    });

    it('returns ok: true when all gate conditions pass and updates DB', async () => {
      const res = await toggleRegistrationAction({
        batchId: BATCH_ID,
        open: true,
      });

      expect(res.ok).toBe(true);
      expect(batchStore.registrationOpen).toBe(true);
    });
  });
});
