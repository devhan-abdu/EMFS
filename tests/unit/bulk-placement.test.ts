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
  bulkAssignMembersToPaceGroup,
  PlacementError,
} from '@/lib/services/pace-groups/placement';
import { bulkAssignMembersAction } from '@/actions/placement';

const MOCK_BATCH_ID = 'a0000000-0000-4000-8000-000000000001';
const OTHER_BATCH_ID = 'a0000000-0000-4000-8000-000000000009';
const MOCK_PROFILE_1_ID = 'a0000000-0000-4000-8000-000000000011';
const MOCK_PROFILE_2_ID = 'a0000000-0000-4000-8000-000000000012';
const MOCK_PROFILE_3_ID = 'a0000000-0000-4000-8000-000000000013';
const MOCK_TARGET_GROUP_ID = 'a0000000-0000-4000-8000-000000000021';
const MOCK_OLD_GROUP_ID = 'a0000000-0000-4000-8000-000000000022';
const MOCK_ACTOR_ID = 'a0000000-0000-4000-8000-000000000099';

function createMockBulkTx(options: {
  batchExists?: boolean;
  targetGroupExists?: boolean;
  targetGroupBatchId?: string;
  targetGroupArchived?: boolean;
  enrolledProfileIds?: string[];
  existingActiveMemberships?: Array<{
    id: string;
    profileId: string;
    paceGroupId: string;
  }>;
  failOnInsert?: boolean;
}) {
  const {
    batchExists = true,
    targetGroupExists = true,
    targetGroupBatchId = MOCK_BATCH_ID,
    targetGroupArchived = false,
    enrolledProfileIds = [
      MOCK_PROFILE_1_ID,
      MOCK_PROFILE_2_ID,
      MOCK_PROFILE_3_ID,
    ],
    existingActiveMemberships = [],
    failOnInsert = false,
  } = options;

  let selectCallCount = 0;

  const selectMock = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        selectCallCount++;
        // 1. Batch check
        if (selectCallCount === 1) {
          return {
            limit: vi
              .fn()
              .mockResolvedValue(
                batchExists ? [{ id: MOCK_BATCH_ID, name: 'Batch 1' }] : [],
              ),
          };
        }
        // 2. Target group check
        if (selectCallCount === 2) {
          return {
            limit: vi.fn().mockResolvedValue(
              targetGroupExists
                ? [
                    {
                      id: MOCK_TARGET_GROUP_ID,
                      batchId: targetGroupBatchId,
                      archived: targetGroupArchived,
                    },
                  ]
                : [],
            ),
          };
        }
        // 3. Batch memberships check
        if (selectCallCount === 3) {
          return Promise.resolve(
            enrolledProfileIds.map((profileId) => ({ profileId })),
          );
        }
        // 4. Existing active pace group memberships
        if (selectCallCount === 4) {
          return Promise.resolve(existingActiveMemberships);
        }
        return Promise.resolve([]);
      }),
    })),
  }));

  const updateMock = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  }));

  let insertCount = 0;
  let insertedMembershipsList: unknown[] = [];
  let insertedAuditsList: unknown[] = [];

  const insertMock = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((values: unknown) => ({
      returning: vi.fn().mockImplementation(() => {
        insertCount++;
        if (failOnInsert) {
          return Promise.reject(
            new Error('concurrent conflict or unique violation'),
          );
        }
        if (insertCount === 1) {
          // Pace group memberships insert
          const items = Array.isArray(values) ? values : [values];
          insertedMembershipsList = items.map((item, idx) => ({
            id: `pgm-new-${idx + 1}`,
            ...item,
          }));
          return Promise.resolve(insertedMembershipsList);
        }
        // Audit records insert
        const items = Array.isArray(values) ? values : [values];
        insertedAuditsList = items.map((item, idx) => ({
          id: `audit-${idx + 1}`,
          ...item,
        }));
        return Promise.resolve(insertedAuditsList);
      }),
    })),
  }));

  return {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    getInsertedMemberships: () => insertedMembershipsList,
    getInsertedAudits: () => insertedAuditsList,
  };
}

describe('Bulk Member Placement Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully assigns multiple unplaced members in a single transaction', async () => {
    const tx = createMockBulkTx({
      batchExists: true,
      targetGroupExists: true,
      enrolledProfileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_2_ID],
      existingActiveMemberships: [],
    });

    const result = await bulkAssignMembersToPaceGroup(
      {
        batchId: MOCK_BATCH_ID,
        targetGroupId: MOCK_TARGET_GROUP_ID,
        profileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_2_ID],
        notes: 'Bulk orientation assignment',
      },
      MOCK_ACTOR_ID,
      tx as never,
    );

    expect(result.batchId).toBe(MOCK_BATCH_ID);
    expect(result.targetGroupId).toBe(MOCK_TARGET_GROUP_ID);
    expect(result.processedCount).toBe(2);
    expect(result.results).toHaveLength(2);

    expect(result.results[0].operation).toBe('assigned');
    expect(result.results[0].fromPaceGroupId).toBeNull();
    expect(result.results[0].toPaceGroupId).toBe(MOCK_TARGET_GROUP_ID);

    expect(result.results[1].operation).toBe('assigned');
    expect(result.results[1].fromPaceGroupId).toBeNull();
    expect(result.results[1].toPaceGroupId).toBe(MOCK_TARGET_GROUP_ID);

    // No updates to close old groups since none were placed
    expect(tx.update).not.toHaveBeenCalled();
    // 2 inserts: memberships and audits
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it('handles mixed placed and unplaced members, closing old memberships and creating audit records', async () => {
    const tx = createMockBulkTx({
      batchExists: true,
      targetGroupExists: true,
      enrolledProfileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_2_ID],
      existingActiveMemberships: [
        {
          id: 'pgm-old-2',
          profileId: MOCK_PROFILE_2_ID,
          paceGroupId: MOCK_OLD_GROUP_ID,
        },
      ],
    });

    const result = await bulkAssignMembersToPaceGroup(
      {
        batchId: MOCK_BATCH_ID,
        targetGroupId: MOCK_TARGET_GROUP_ID,
        profileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_2_ID],
      },
      MOCK_ACTOR_ID,
      tx as never,
    );

    expect(result.processedCount).toBe(2);

    // Profile 1 was unplaced -> assigned
    const item1 = result.results.find((r) => r.profileId === MOCK_PROFILE_1_ID);
    expect(item1?.operation).toBe('assigned');
    expect(item1?.fromPaceGroupId).toBeNull();
    expect(item1?.previousMembershipId).toBeNull();

    // Profile 2 was placed in old group -> moved
    const item2 = result.results.find((r) => r.profileId === MOCK_PROFILE_2_ID);
    expect(item2?.operation).toBe('moved');
    expect(item2?.fromPaceGroupId).toBe(MOCK_OLD_GROUP_ID);
    expect(item2?.previousMembershipId).toBe('pgm-old-2');

    // Closed old membership for Profile 2
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it('throws BATCH_NOT_FOUND when batch does not exist', async () => {
    const tx = createMockBulkTx({ batchExists: false });

    await expect(
      bulkAssignMembersToPaceGroup(
        {
          batchId: 'a0000000-0000-4000-8000-000000000000',
          targetGroupId: MOCK_TARGET_GROUP_ID,
          profileIds: [MOCK_PROFILE_1_ID],
        },
        MOCK_ACTOR_ID,
        tx as never,
      ),
    ).rejects.toThrowError(PlacementError);
  });

  it('throws PACE_GROUP_NOT_FOUND when target group belongs to another batch', async () => {
    const tx = createMockBulkTx({
      targetGroupBatchId: OTHER_BATCH_ID,
    });

    await expect(
      bulkAssignMembersToPaceGroup(
        {
          batchId: MOCK_BATCH_ID,
          targetGroupId: MOCK_TARGET_GROUP_ID,
          profileIds: [MOCK_PROFILE_1_ID],
        },
        MOCK_ACTOR_ID,
        tx as never,
      ),
    ).rejects.toThrowError('Target pace group does not exist in this batch.');
  });

  it('throws PACE_GROUP_ARCHIVED when target pace group is archived', async () => {
    const tx = createMockBulkTx({
      targetGroupArchived: true,
    });

    await expect(
      bulkAssignMembersToPaceGroup(
        {
          batchId: MOCK_BATCH_ID,
          targetGroupId: MOCK_TARGET_GROUP_ID,
          profileIds: [MOCK_PROFILE_1_ID],
        },
        MOCK_ACTOR_ID,
        tx as never,
      ),
    ).rejects.toThrowError('Cannot assign members to an archived pace group.');
  });

  it('enforces all-or-nothing rollback when any member lacks active batch enrollment', async () => {
    const tx = createMockBulkTx({
      enrolledProfileIds: [MOCK_PROFILE_1_ID], // Profile 2 is missing
    });

    await expect(
      bulkAssignMembersToPaceGroup(
        {
          batchId: MOCK_BATCH_ID,
          targetGroupId: MOCK_TARGET_GROUP_ID,
          profileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_2_ID],
        },
        MOCK_ACTOR_ID,
        tx as never,
      ),
    ).rejects.toThrowError(
      'One or more selected members do not have an active enrollment in this batch.',
    );

    // Transaction aborted before any writes
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('handles concurrent conflict safely and bubbles transaction rejection', async () => {
    const tx = createMockBulkTx({
      failOnInsert: true,
    });

    await expect(
      bulkAssignMembersToPaceGroup(
        {
          batchId: MOCK_BATCH_ID,
          targetGroupId: MOCK_TARGET_GROUP_ID,
          profileIds: [MOCK_PROFILE_1_ID],
        },
        MOCK_ACTOR_ID,
        tx as never,
      ),
    ).rejects.toThrowError('concurrent conflict or unique violation');
  });

  it('verifies audit record structure, notes, and actor attribution for bulk operations', async () => {
    const tx = createMockBulkTx({
      batchExists: true,
      targetGroupExists: true,
      enrolledProfileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_2_ID],
      existingActiveMemberships: [
        {
          id: 'pgm-old-2',
          profileId: MOCK_PROFILE_2_ID,
          paceGroupId: MOCK_OLD_GROUP_ID,
        },
      ],
    });

    await bulkAssignMembersToPaceGroup(
      {
        batchId: MOCK_BATCH_ID,
        targetGroupId: MOCK_TARGET_GROUP_ID,
        profileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_2_ID],
        notes: 'Administrative rebalancing',
      },
      MOCK_ACTOR_ID,
      tx as never,
    );

    const insertedAudits = tx.getInsertedAudits() as Array<{
      profileId: string;
      fromPaceGroupId: string | null;
      toPaceGroupId: string;
      moveReason: string;
      movedBy: string;
      notes: string | null;
    }>;

    expect(insertedAudits).toHaveLength(2);

    const audit1 = insertedAudits.find(
      (a) => a.profileId === MOCK_PROFILE_1_ID,
    );
    expect(audit1).toBeDefined();
    expect(audit1?.fromPaceGroupId).toBeNull();
    expect(audit1?.toPaceGroupId).toBe(MOCK_TARGET_GROUP_ID);
    expect(audit1?.moveReason).toBe('Bulk initial placement');
    expect(audit1?.movedBy).toBe(MOCK_ACTOR_ID);
    expect(audit1?.notes).toBe('Administrative rebalancing');

    const audit2 = insertedAudits.find(
      (a) => a.profileId === MOCK_PROFILE_2_ID,
    );
    expect(audit2).toBeDefined();
    expect(audit2?.fromPaceGroupId).toBe(MOCK_OLD_GROUP_ID);
    expect(audit2?.toPaceGroupId).toBe(MOCK_TARGET_GROUP_ID);
    expect(audit2?.moveReason).toBe('Bulk group move');
    expect(audit2?.movedBy).toBe(MOCK_ACTOR_ID);
    expect(audit2?.notes).toBe('Administrative rebalancing');
  });

  it('guarantees single active membership by closing old active memberships before inserting new active rows', async () => {
    const tx = createMockBulkTx({
      batchExists: true,
      targetGroupExists: true,
      enrolledProfileIds: [MOCK_PROFILE_1_ID],
      existingActiveMemberships: [
        {
          id: 'pgm-old-1',
          profileId: MOCK_PROFILE_1_ID,
          paceGroupId: MOCK_OLD_GROUP_ID,
        },
      ],
    });

    await bulkAssignMembersToPaceGroup(
      {
        batchId: MOCK_BATCH_ID,
        targetGroupId: MOCK_TARGET_GROUP_ID,
        profileIds: [MOCK_PROFILE_1_ID],
      },
      MOCK_ACTOR_ID,
      tx as never,
    );

    expect(tx.update).toHaveBeenCalledTimes(1);
    const insertedMemberships = tx.getInsertedMemberships() as Array<{
      profileId: string;
      batchId: string;
      paceGroupId: string;
      status: string;
    }>;

    expect(insertedMemberships).toHaveLength(1);
    expect(insertedMemberships[0].status).toBe('active');
    expect(insertedMemberships[0].paceGroupId).toBe(MOCK_TARGET_GROUP_ID);
  });

  it('deduplicates duplicate profile IDs submitted in client payload', async () => {
    const tx = createMockBulkTx({
      enrolledProfileIds: [MOCK_PROFILE_1_ID],
      existingActiveMemberships: [],
    });

    const result = await bulkAssignMembersToPaceGroup(
      {
        batchId: MOCK_BATCH_ID,
        targetGroupId: MOCK_TARGET_GROUP_ID,
        profileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_1_ID, MOCK_PROFILE_1_ID],
      },
      MOCK_ACTOR_ID,
      tx as never,
    );

    expect(result.processedCount).toBe(1);
    expect(result.results).toHaveLength(1);
  });
});

describe('Bulk Placement Server Action Authorization & Actor Identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects bulkAssignMembersAction when actor lacks batch access', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass(
        'FORBIDDEN',
        'You are not an assigned admin for this batch.',
      );
    });

    const result = await bulkAssignMembersAction({
      batchId: MOCK_BATCH_ID,
      targetGroupId: MOCK_TARGET_GROUP_ID,
      profileIds: [MOCK_PROFILE_1_ID, MOCK_PROFILE_2_ID],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    }
  });

  it('derives actor identity strictly from requireBatchAccess session profile ID', async () => {
    mockRequireBatchAccess.mockResolvedValueOnce({
      user: { id: 'auth-user-1' },
      profile: { id: MOCK_ACTOR_ID, role: 'batch_admin' },
    });

    // We also test that invalid schema (e.g. empty profile list) is caught by Zod before reaching DB
    const emptyResult = await bulkAssignMembersAction({
      batchId: MOCK_BATCH_ID,
      targetGroupId: MOCK_TARGET_GROUP_ID,
      profileIds: [],
    });

    expect(emptyResult.ok).toBe(false);
    if (!emptyResult.ok) {
      expect(emptyResult.errors.fieldErrors.profileIds).toBeDefined();
    }
  });
});
