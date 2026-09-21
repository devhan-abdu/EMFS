import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// Mock DB for auth and service calls
const mockFindFirstBatchAdmin = vi.fn();
const mockFindManyBatchAdmins = vi.fn();
const mockFindFirstPaceAdminAssignment = vi.fn();
const mockFindManyPaceAdminAssignments = vi.fn();
const mockFindFirstPaceGroup = vi.fn();
const mockFindManyPaceGroups = vi.fn();
const mockFindFirstBatch = vi.fn();
const mockFindFirstApplication = vi.fn();
const mockFindFirstMembership = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    query: {
      batchAdmins: {
        findFirst: (...args: unknown[]) => mockFindFirstBatchAdmin(...args),
        findMany: (...args: unknown[]) => mockFindManyBatchAdmins(...args),
      },
      paceAdminAssignments: {
        findFirst: (...args: unknown[]) =>
          mockFindFirstPaceAdminAssignment(...args),
        findMany: (...args: unknown[]) =>
          mockFindManyPaceAdminAssignments(...args),
      },
      paceGroups: {
        findFirst: (...args: unknown[]) => mockFindFirstPaceGroup(...args),
        findMany: (...args: unknown[]) => mockFindManyPaceGroups(...args),
      },
      batches: {
        findFirst: (...args: unknown[]) => mockFindFirstBatch(...args),
      },
      applications: {
        findFirst: (...args: unknown[]) => mockFindFirstApplication(...args),
      },
      batchMemberships: {
        findFirst: (...args: unknown[]) => mockFindFirstMembership(...args),
      },
    },
  },
}));

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: async () => mockGetCurrentUser(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  requireSuperAdmin,
  requireBatchAccess,
  requirePaceGroupAccess,
  getAuthorizedBatchIds,
  getAuthorizedPaceGroupIds,
  AuthzError,
} from '@/lib/auth/authorize';
import type { CurrentUser } from '@/lib/auth/session';
import type { Profile } from '@/db/schema';
import { getAdminApplications } from '@/lib/services/admin';
import { getAdminApplicationsWithHandoff } from '@/lib/services/application/admin-handoff';
import { toggleRegistrationAction } from '@/actions/batch-toggle';
import { reviewApplicationAction } from '@/actions/application-review';
import { createMembershipAction } from '@/actions/membership';
import { getBatchMoveHistory } from '@/lib/services/pace-groups/placement';

const BATCH_1_ID = '11111111-0000-4000-8000-000000000001';
const BATCH_2_ID = '22222222-0000-4000-8000-000000000002';
const GROUP_1A_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const GROUP_1B_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const GROUP_2A_ID = 'cccccccc-0000-4000-8000-000000000003';
const APPLICATION_2_ID = '44444444-0000-4000-8000-000000000002';
const PROFILE_MEMBER_ID = '55555555-0000-4000-8000-000000000005';

function createTestUser(
  authUserId: string,
  email: string,
  profileId: string,
  role: Profile['role'],
  firstName: string,
  fatherName: string,
): CurrentUser {
  return {
    authUserId,
    email,
    profile: {
      id: profileId,
      authUserId,
      role,
      firstName,
      fatherName,
      grandfatherName: null,
      telegramUsername: null,
      phone: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  };
}

const SUPER_ADMIN_USER = createTestUser(
  'u_super',
  'super@emfs.org',
  'p_super',
  'super_admin',
  'Super',
  'Admin',
);

const BATCH_1_ADMIN_USER = createTestUser(
  'u_batch1',
  'batch1@emfs.org',
  'p_batch1',
  'batch_admin',
  'Batch1',
  'Admin',
);

const PACE_ADMIN_1A_USER = createTestUser(
  'u_pace1a',
  'pace1a@emfs.org',
  'p_pace1a',
  'pace_admin',
  'Pace1A',
  'Admin',
);

const MEMBER_USER = createTestUser(
  'u_member',
  'member@emfs.org',
  'p_member',
  'member',
  'Regular',
  'Member',
);

describe('Admin Authorization & Data Isolation Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. PACE ADMIN Access & Data Isolation', () => {
    it('sees only groups they are assigned to via getAuthorizedPaceGroupIds', async () => {
      mockFindManyPaceAdminAssignments.mockResolvedValueOnce([
        { paceGroupId: GROUP_1A_ID },
      ]);

      const groupIds = await getAuthorizedPaceGroupIds(PACE_ADMIN_1A_USER);
      expect(groupIds).toEqual([GROUP_1A_ID]);
      expect(groupIds).not.toContain(GROUP_1B_ID);
      expect(groupIds).not.toContain(GROUP_2A_ID);
    });

    it('requirePaceGroupAccess permits assigned pace admin', async () => {
      mockGetCurrentUser.mockReturnValueOnce(PACE_ADMIN_1A_USER);
      mockFindFirstPaceGroup.mockResolvedValueOnce({
        id: GROUP_1A_ID,
        batchId: BATCH_1_ID,
      });
      mockFindFirstPaceAdminAssignment.mockResolvedValueOnce({
        id: 'assign_1',
        profileId: PACE_ADMIN_1A_USER.profile.id,
        paceGroupId: GROUP_1A_ID,
      });

      const user = await requirePaceGroupAccess(GROUP_1A_ID);
      expect(user.profile.id).toBe(PACE_ADMIN_1A_USER.profile.id);
    });

    it('requirePaceGroupAccess throws FORBIDDEN when pace admin tries to access another group', async () => {
      mockGetCurrentUser.mockReturnValueOnce(PACE_ADMIN_1A_USER);
      mockFindFirstPaceGroup.mockResolvedValueOnce({
        id: GROUP_1B_ID,
        batchId: BATCH_1_ID,
      });
      mockFindFirstPaceAdminAssignment.mockResolvedValueOnce(null); // Not assigned to Group 1B

      await expect(requirePaceGroupAccess(GROUP_1B_ID)).rejects.toThrowError(
        AuthzError,
      );
    });

    it('requireBatchAccess rejects pace admin (cannot perform batch-level placement or settings)', async () => {
      mockGetCurrentUser.mockReturnValueOnce(PACE_ADMIN_1A_USER);

      await expect(requireBatchAccess(BATCH_1_ID)).rejects.toThrowError(
        AuthzError,
      );
    });

    it('getAdminApplications returns empty array for pace admin (cannot review intake applications)', async () => {
      const apps = await getAdminApplications(PACE_ADMIN_1A_USER);
      expect(apps).toEqual([]);
    });
  });

  describe('2. BATCH ADMIN Access & Data Isolation', () => {
    it('sees only batches they are assigned to via getAuthorizedBatchIds', async () => {
      mockFindManyBatchAdmins.mockResolvedValueOnce([{ batchId: BATCH_1_ID }]);

      const batchIds = await getAuthorizedBatchIds(BATCH_1_ADMIN_USER);
      expect(batchIds).toEqual([BATCH_1_ID]);
      expect(batchIds).not.toContain(BATCH_2_ID);
    });

    it('requireBatchAccess succeeds for assigned batch', async () => {
      mockGetCurrentUser.mockReturnValueOnce(BATCH_1_ADMIN_USER);
      mockFindFirstBatchAdmin.mockResolvedValueOnce({
        id: 'ba_1',
        batchId: BATCH_1_ID,
        profileId: BATCH_1_ADMIN_USER.profile.id,
      });

      const user = await requireBatchAccess(BATCH_1_ID);
      expect(user.profile.id).toBe(BATCH_1_ADMIN_USER.profile.id);
    });

    it('requireBatchAccess throws FORBIDDEN on unauthorized batch (prevents direct-URL bypass)', async () => {
      mockGetCurrentUser.mockReturnValueOnce(BATCH_1_ADMIN_USER);
      mockFindFirstBatchAdmin.mockResolvedValueOnce(null); // Not assigned to Batch 2

      await expect(requireBatchAccess(BATCH_2_ID)).rejects.toThrowError(
        'You are not an assigned admin for this batch.',
      );
    });

    it('getAdminApplicationsWithHandoff blocks client-controlled scope bypass for unassigned batch', async () => {
      mockFindManyBatchAdmins.mockResolvedValueOnce([{ batchId: BATCH_1_ID }]);

      // Batch 1 admin tries to query Batch 2 applications via ?batch=BATCH_2_ID
      const apps = await getAdminApplicationsWithHandoff(
        BATCH_2_ID,
        BATCH_1_ADMIN_USER,
      );

      // Must return empty array, NOT leak Batch 2 applications
      expect(apps).toEqual([]);
    });

    it('toggleRegistrationAction blocks batch admin from toggling registration on unassigned batch', async () => {
      mockGetCurrentUser.mockReturnValueOnce(BATCH_1_ADMIN_USER);
      mockFindFirstBatchAdmin.mockResolvedValueOnce(null); // Batch 1 admin on Batch 2

      const result = await toggleRegistrationAction({
        batchId: BATCH_2_ID,
        open: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.formErrors).toContain(
          'You are not an assigned admin for this batch.',
        );
      }
    });

    it('reviewApplicationAction blocks batch admin from reviewing applicant from unassigned batch', async () => {
      mockGetCurrentUser.mockReturnValueOnce(BATCH_1_ADMIN_USER);
      // Application belongs to Batch 2
      mockFindFirstApplication.mockResolvedValueOnce({
        id: APPLICATION_2_ID,
        batchId: BATCH_2_ID,
        profileId: PROFILE_MEMBER_ID,
      });
      // Admin is not assigned to Batch 2
      mockFindFirstBatchAdmin.mockResolvedValueOnce(null);

      const result = await reviewApplicationAction({
        applicationId: APPLICATION_2_ID,
        decision: 'approved',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.formErrors).toContain(
          'You are not an assigned admin for this batch.',
        );
      }
    });

    it('membership actions block batch admin from mutating memberships in unassigned batch', async () => {
      mockGetCurrentUser.mockReturnValueOnce(BATCH_1_ADMIN_USER);
      mockFindFirstBatchAdmin.mockResolvedValueOnce(null); // Not assigned to Batch 2

      const result = await createMembershipAction({
        batchId: BATCH_2_ID,
        profileId: PROFILE_MEMBER_ID,
        status: 'active',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.formErrors).toContain(
          'You are not an assigned admin for this batch.',
        );
      }
    });
  });

  describe('3. SUPER ADMIN Access', () => {
    it('super admin gets "all" for getAuthorizedBatchIds and getAuthorizedPaceGroupIds', async () => {
      const batchIds = await getAuthorizedBatchIds(SUPER_ADMIN_USER);
      expect(batchIds).toBe('all');

      const groupIds = await getAuthorizedPaceGroupIds(SUPER_ADMIN_USER);
      expect(groupIds).toBe('all');
    });

    it('requireBatchAccess succeeds for super admin on any batch without checking batch_admins table', async () => {
      mockGetCurrentUser.mockReturnValue(SUPER_ADMIN_USER);

      const user = await requireBatchAccess(BATCH_2_ID);
      expect(user.profile.id).toBe(SUPER_ADMIN_USER.profile.id);
      expect(mockFindFirstBatchAdmin).not.toHaveBeenCalled();
    });

    it('requirePaceGroupAccess succeeds for super admin on any pace group', async () => {
      mockGetCurrentUser.mockReturnValue(SUPER_ADMIN_USER);

      const user = await requirePaceGroupAccess(GROUP_2A_ID);
      expect(user.profile.id).toBe(SUPER_ADMIN_USER.profile.id);
    });

    it('requireSuperAdmin passes for super_admin and throws FORBIDDEN for other roles', async () => {
      mockGetCurrentUser.mockReturnValue(SUPER_ADMIN_USER);
      const superUser = await requireSuperAdmin();
      expect(superUser.profile.id).toBe(SUPER_ADMIN_USER.profile.id);

      mockGetCurrentUser.mockReturnValue(BATCH_1_ADMIN_USER);
      await expect(requireSuperAdmin()).rejects.toThrowError(AuthzError);

      mockGetCurrentUser.mockReturnValue(PACE_ADMIN_1A_USER);
      await expect(requireSuperAdmin()).rejects.toThrowError(AuthzError);

      mockGetCurrentUser.mockReturnValue(MEMBER_USER);
      await expect(requireSuperAdmin()).rejects.toThrowError(AuthzError);
    });
  });

  describe('4. Historical Task & Move List Pagination / Capping', () => {
    it('caps historical move query limit to a maximum of 100 items', async () => {
      const mockQueryWhere = vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      const chainable = () => ({
        innerJoin: chainable,
        leftJoin: chainable,
        where: mockQueryWhere,
      });

      const mockFromCount = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValueOnce([{ totalCount: 250 }]),
            }),
          }),
        }),
      });

      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        return {
          from: callCount === 1 ? mockFromCount : () => chainable(),
        };
      });

      mockFindFirstBatch.mockResolvedValueOnce({ id: BATCH_1_ID });

      // Request limit 500 (exceeds cap of 100)
      const history = await getBatchMoveHistory({
        batchId: BATCH_1_ID,
        page: 1,
        limit: 500,
      });

      // Must cap limit to 100 and compute totalPages accordingly (250 / 100 = 3 pages)
      expect(history.limit).toBe(100);
      expect(history.totalPages).toBe(3);
    });
  });
});
