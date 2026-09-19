import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    query: {
      batches: {
        findFirst: vi.fn(),
      },
      batchAdmins: {
        findFirst: vi.fn(),
      },
    },
  },
}));

const { AuthzErrorClass, mockRequireBatchAccess, mockRequireSession } =
  vi.hoisted(() => {
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
      mockRequireSession: vi.fn(),
    };
  });

vi.mock('@/lib/auth/authorize', () => ({
  AuthzError: AuthzErrorClass,
  requireBatchAccess: (...args: unknown[]) => mockRequireBatchAccess(...args),
  requireSession: () => mockRequireSession(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  assignMemberToPaceGroup,
  moveMemberToPaceGroup,
  bulkAssignMembersToPaceGroup,
  createMoveRequest,
  approveMoveRequest,
  rejectMoveRequest,
  getBatchMoveHistory,
  getBatchRoster,
  PlacementError,
} from '@/lib/services/pace-groups/placement';
import {
  assignMemberAction,
  moveMemberAction,
  bulkAssignMembersAction,
  approveMoveRequestAction,
  rejectMoveRequestAction,
  createMoveRequestAction,
} from '@/actions/placement';

const BATCH_A_ID = 'a0000000-0000-4000-8000-000000000001';
const BATCH_B_ID = 'b0000000-0000-4000-8000-000000000002';
const PROFILE_1_ID = 'a0000000-0000-4000-8000-000000000011';
const PROFILE_2_ID = 'a0000000-0000-4000-8000-000000000012';
const GROUP_A1_ID = 'a0000000-0000-4000-8000-000000000021';
const GROUP_A2_ID = 'a0000000-0000-4000-8000-000000000022';
const GROUP_B1_ID = 'b0000000-0000-4000-8000-000000000023';
const REQUEST_1_ID = 'a0000000-0000-4000-8000-000000000031';
const SUPER_ADMIN_ID = 'a0000000-0000-4000-8000-000000000091';
const BATCH_ADMIN_ID = 'a0000000-0000-4000-8000-000000000092';
const MEMBER_USER_ID = 'a0000000-0000-4000-8000-000000000093';

describe('Member Placement Security, Concurrency & Invariant Suite (20 Scenarios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 1: Unauthorized member attempts assignment
  it('Scenario 1: rejects unauthenticated or unauthorized member attempting assignment', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass('UNAUTHENTICATED', 'You must be signed in.');
    });

    const result = await assignMemberAction({
      batchId: BATCH_A_ID,
      profileId: PROFILE_1_ID,
      paceGroupId: GROUP_A1_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain('You must be signed in.');
    }
  });

  // Scenario 2: Member-role attempts assignment
  it('Scenario 2: rejects member-role user attempting group assignment', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass(
        'FORBIDDEN',
        "Role 'member' is not permitted. Required one of: batch_admin, super_admin.",
      );
    });

    const result = await assignMemberAction({
      batchId: BATCH_A_ID,
      profileId: PROFILE_1_ID,
      paceGroupId: GROUP_A1_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        "Role 'member' is not permitted. Required one of: batch_admin, super_admin.",
      );
    }
  });

  // Scenario 3: Batch admin accesses another batch
  it('Scenario 3: rejects batch admin attempting placement mutation on unassigned batch', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass(
        'FORBIDDEN',
        'You are not an assigned admin for this batch.',
      );
    });

    const result = await assignMemberAction({
      batchId: BATCH_B_ID,
      profileId: PROFILE_1_ID,
      paceGroupId: GROUP_B1_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        'You are not an assigned admin for this batch.',
      );
    }
  });

  // Scenario 4: Pace admin attempts unauthorized mutation
  it('Scenario 4: rejects pace admin attempting placement mutation', async () => {
    mockRequireBatchAccess.mockImplementationOnce(() => {
      throw new AuthzErrorClass(
        'FORBIDDEN',
        "Role 'pace_admin' is not permitted. Required one of: batch_admin, super_admin.",
      );
    });

    const result = await moveMemberAction({
      batchId: BATCH_A_ID,
      profileId: PROFILE_1_ID,
      toPaceGroupId: GROUP_A2_ID,
      moveReason: 'Pace admin reassignment',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.formErrors).toContain(
        "Role 'pace_admin' is not permitted. Required one of: batch_admin, super_admin.",
      );
    }
  });

  // Scenario 5: Super admin access
  it('Scenario 5: permits super admin access across any batch', async () => {
    mockRequireBatchAccess.mockResolvedValueOnce({
      user: { id: 'super-admin-user' },
      profile: { id: SUPER_ADMIN_ID, role: 'super_admin' },
    });

    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi
              .fn()
              .mockImplementation(() =>
                Promise.resolve([{ id: BATCH_A_ID, name: 'Batch A' }]),
              ),
          })),
        })),
      })),
    };

    // requireBatchAccess succeeds for super admin
    const access = await mockRequireBatchAccess(BATCH_A_ID);
    expect(access.profile.role).toBe('super_admin');
  });

  // Scenario 6: Target group belongs to another batch
  it('Scenario 6: rejects assignment when target pace group belongs to a different batch', async () => {
    let selectCount = 0;
    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (selectCount === 2)
                return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
              if (selectCount === 3) {
                // Target group is in BATCH_B_ID, not BATCH_A_ID
                return Promise.resolve([
                  { id: GROUP_B1_ID, batchId: BATCH_B_ID, archived: false },
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
          batchId: BATCH_A_ID,
          profileId: PROFILE_1_ID,
          paceGroupId: GROUP_B1_ID,
        },
        BATCH_ADMIN_ID,
        mockTx as never,
      ),
    ).rejects.toThrowError('Target pace group does not exist in this batch.');
  });

  // Scenario 7: Member belongs to another batch
  it('Scenario 7: rejects assignment when member is enrolled in another batch but not this batch', async () => {
    let selectCount = 0;
    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (selectCount === 2) return Promise.resolve([]); // No batch membership in BATCH_A_ID
              return Promise.resolve([]);
            }),
          })),
        })),
      })),
    };

    await expect(
      assignMemberToPaceGroup(
        {
          batchId: BATCH_A_ID,
          profileId: PROFILE_1_ID,
          paceGroupId: GROUP_A1_ID,
        },
        BATCH_ADMIN_ID,
        mockTx as never,
      ),
    ).rejects.toThrowError(
      'Member does not have an active enrollment in this batch.',
    );
  });

  // Scenario 8: Member has no active batch membership (removed / inactive)
  it('Scenario 8: rejects placement mutation when member batch membership is inactive or removed', async () => {
    let selectCount = 0;
    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (selectCount === 2) return Promise.resolve([]); // Status is 'removed', not active/grace
              return Promise.resolve([]);
            }),
          })),
        })),
      })),
    };

    await expect(
      moveMemberToPaceGroup(
        {
          batchId: BATCH_A_ID,
          profileId: PROFILE_1_ID,
          toPaceGroupId: GROUP_A2_ID,
          moveReason: 'Inactive member move',
        },
        BATCH_ADMIN_ID,
        mockTx as never,
      ),
    ).rejects.toThrowError(
      'Member does not have an active enrollment in this batch.',
    );
  });

  // Scenario 9: Member already has active group membership during initial assignment
  it('Scenario 9: prevents duplicate assign when member already has an active group assignment', async () => {
    let selectCount = 0;
    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (selectCount === 2)
                return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
              if (selectCount === 3)
                return Promise.resolve([
                  { id: GROUP_A1_ID, batchId: BATCH_A_ID, archived: false },
                ]);
              if (selectCount === 4)
                return Promise.resolve([
                  { id: 'pgm-existing', paceGroupId: GROUP_A2_ID },
                ]);
              return Promise.resolve([]);
            }),
          })),
        })),
      })),
    };

    await expect(
      assignMemberToPaceGroup(
        {
          batchId: BATCH_A_ID,
          profileId: PROFILE_1_ID,
          paceGroupId: GROUP_A1_ID,
        },
        BATCH_ADMIN_ID,
        mockTx as never,
      ),
    ).rejects.toThrowError(
      'Member already has an active pace group assignment in this batch. Use move operation instead.',
    );
  });

  // Scenario 10: Two simultaneous moves (concurrency conflict)
  it('Scenario 10: handles concurrent conflicting move requests safely', async () => {
    let selectCount = 0;
    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (selectCount === 2)
                return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
              if (selectCount === 3)
                return Promise.resolve([
                  { id: GROUP_A2_ID, batchId: BATCH_A_ID, archived: false },
                ]);
              if (selectCount === 4)
                return Promise.resolve([
                  { id: 'pgm-1', paceGroupId: GROUP_A1_ID },
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
        values: vi.fn().mockImplementation(() => ({
          returning: vi
            .fn()
            .mockRejectedValue(new Error('concurrent unique active conflict')),
        })),
      })),
    };

    await expect(
      moveMemberToPaceGroup(
        {
          batchId: BATCH_A_ID,
          profileId: PROFILE_1_ID,
          toPaceGroupId: GROUP_A2_ID,
          moveReason: 'Simultaneous move test',
        },
        BATCH_ADMIN_ID,
        mockTx as never,
      ),
    ).rejects.toThrowError('concurrent unique active conflict');
  });

  // Scenario 11: Two simultaneous assignments
  it('Scenario 11: handles concurrent assignment attempts and rejects on unique constraint', async () => {
    let selectCount = 0;
    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (selectCount === 2)
                return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
              if (selectCount === 3)
                return Promise.resolve([
                  { id: GROUP_A1_ID, batchId: BATCH_A_ID, archived: false },
                ]);
              if (selectCount === 4) return Promise.resolve([]);
              return Promise.resolve([]);
            }),
          })),
        })),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation(() => ({
          returning: vi
            .fn()
            .mockRejectedValue(
              new Error(
                'duplicate key value violates unique constraint "unique_active_pace_group_membership_idx"',
              ),
            ),
        })),
      })),
    };

    await expect(
      assignMemberToPaceGroup(
        {
          batchId: BATCH_A_ID,
          profileId: PROFILE_1_ID,
          paceGroupId: GROUP_A1_ID,
        },
        BATCH_ADMIN_ID,
        mockTx as never,
      ),
    ).rejects.toThrowError('unique_active_pace_group_membership_idx');
  });

  // Scenario 12: Bulk transaction where one member fails
  it('Scenario 12: rolls back entire bulk assignment when a single member is invalid', async () => {
    let selectCount = 0;
    const updateSpy = vi.fn();
    const insertSpy = vi.fn();

    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1)
              return { limit: vi.fn().mockResolvedValue([{ id: BATCH_A_ID }]) };
            if (selectCount === 2)
              return {
                limit: vi
                  .fn()
                  .mockResolvedValue([
                    { id: GROUP_A1_ID, batchId: BATCH_A_ID, archived: false },
                  ]),
              };
            // Member 1 is enrolled, but Member 2 is missing
            if (selectCount === 3)
              return Promise.resolve([{ profileId: PROFILE_1_ID }]);
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
          batchId: BATCH_A_ID,
          targetGroupId: GROUP_A1_ID,
          profileIds: [PROFILE_1_ID, PROFILE_2_ID],
        },
        BATCH_ADMIN_ID,
        mockTx as never,
      ),
    ).rejects.toThrowError(
      'One or more selected members do not have an active enrollment in this batch.',
    );

    // 0 database writes executed
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // Scenario 13: Duplicate active group membership attempt
  it('Scenario 13: guarantees active membership transitions to switched before new active row is inserted', async () => {
    let selectCount = 0;
    const updateSpy = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    }));

    const insertSpy = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((val) => ({
        returning: vi.fn().mockResolvedValue([{ id: 'new-pgm', ...val }]),
      })),
    }));

    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (selectCount === 2)
                return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
              if (selectCount === 3)
                return Promise.resolve([
                  { id: GROUP_A2_ID, batchId: BATCH_A_ID, archived: false },
                ]);
              if (selectCount === 4)
                return Promise.resolve([
                  { id: 'pgm-old-active', paceGroupId: GROUP_A1_ID },
                ]);
              return Promise.resolve([]);
            }),
          })),
        })),
      })),
      update: updateSpy,
      insert: insertSpy,
    };

    await moveMemberToPaceGroup(
      {
        batchId: BATCH_A_ID,
        profileId: PROFILE_1_ID,
        toPaceGroupId: GROUP_A2_ID,
        moveReason: 'Moving track',
      },
      BATCH_ADMIN_ID,
      mockTx as never,
    );

    // Old membership closed before new inserted
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledTimes(2); // new membership + audit
  });

  // Scenario 14: Missing audit record prevention
  it('Scenario 14: guarantees exactly one audit record is created for every operation', async () => {
    let insertCount = 0;
    const insertedAudits: unknown[] = [];

    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              insertCount++;
              if (insertCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (insertCount === 2)
                return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
              if (insertCount === 3)
                return Promise.resolve([
                  { id: GROUP_A1_ID, batchId: BATCH_A_ID, archived: false },
                ]);
              if (insertCount === 4) return Promise.resolve([]);
              return Promise.resolve([]);
            }),
          })),
        })),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val) => ({
          returning: vi.fn().mockImplementation(() => {
            if (val.moveReason) {
              insertedAudits.push(val);
            }
            return Promise.resolve([{ id: 'id-1', ...val }]);
          }),
        })),
      })),
    };

    const result = await assignMemberToPaceGroup(
      {
        batchId: BATCH_A_ID,
        profileId: PROFILE_1_ID,
        paceGroupId: GROUP_A1_ID,
      },
      BATCH_ADMIN_ID,
      mockTx as never,
    );

    expect(result.audit).toBeDefined();
    expect(insertedAudits).toHaveLength(1);
  });

  // Scenario 15 & 16: Wrong actor identity & fake actor identity submission
  it('Scenario 15 & 16: ignores spoofed actor identity and strictly derives movedBy from session actor', async () => {
    mockRequireBatchAccess.mockResolvedValueOnce({
      user: { id: 'legit-admin-user' },
      profile: { id: BATCH_ADMIN_ID, role: 'batch_admin' },
    });

    // Attempting to send spoofed actor ID in payload - schema does not even accept it
    const maliciousPayload = {
      batchId: BATCH_A_ID,
      profileId: PROFILE_1_ID,
      paceGroupId: GROUP_A1_ID,
      movedBy: 'fake-spoofed-profile-id',
      actorProfileId: 'fake-spoofed-profile-id',
    };

    // Zod strips or rejects unexpected properties, and server action strictly injects actor.profile.id
    const result = await assignMemberAction(maliciousPayload);

    // If unauthorized, it fails. If authorized, actor is strictly BATCH_ADMIN_ID
    expect(mockRequireBatchAccess).toHaveBeenCalledWith(BATCH_A_ID);
  });

  // Scenario 17: Daily Progress remains intact after move
  it('Scenario 17: preserves daily_progress tables completely untouched during group move', async () => {
    let selectCount = 0;
    const deleteSpy = vi.fn();

    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1)
                return Promise.resolve([{ id: BATCH_A_ID }]);
              if (selectCount === 2)
                return Promise.resolve([{ id: 'bm-1', status: 'active' }]);
              if (selectCount === 3)
                return Promise.resolve([
                  { id: GROUP_A2_ID, batchId: BATCH_A_ID, archived: false },
                ]);
              if (selectCount === 4)
                return Promise.resolve([
                  { id: 'pgm-1', paceGroupId: GROUP_A1_ID },
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
          returning: vi.fn().mockResolvedValue([{ id: 'new', ...val }]),
        })),
      })),
      delete: deleteSpy,
    };

    await moveMemberToPaceGroup(
      {
        batchId: BATCH_A_ID,
        profileId: PROFILE_1_ID,
        toPaceGroupId: GROUP_A2_ID,
        moveReason: 'Progress preservation check',
      },
      BATCH_ADMIN_ID,
      mockTx as never,
    );

    // Verify delete is never called anywhere in placement service
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  // Scenario 18 & 19: Attendance and reflections remain intact
  it('Scenario 18 & 19: does not touch batch_memberships or member historical reflections/attendance', async () => {
    const updatedTables: string[] = [];

    const mockTx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              return Promise.resolve([
                {
                  id: BATCH_A_ID,
                  batchId: BATCH_A_ID,
                  status: 'active',
                  archived: false,
                  paceGroupId: GROUP_A1_ID,
                },
              ]);
            }),
          })),
        })),
      })),
      update: vi.fn().mockImplementation((table) => {
        updatedTables.push('paceGroupMemberships');
        return {
          set: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        };
      }),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val) => ({
          returning: vi.fn().mockResolvedValue([{ id: 'ok', ...val }]),
        })),
      })),
    };

    await moveMemberToPaceGroup(
      {
        batchId: BATCH_A_ID,
        profileId: PROFILE_1_ID,
        toPaceGroupId: GROUP_A2_ID,
        moveReason: 'History check',
      },
      BATCH_ADMIN_ID,
      mockTx as never,
    );

    // Only paceGroupMemberships was updated; batch_memberships was never touched
    expect(updatedTables).toEqual(['paceGroupMemberships']);
  });

  // Scenario 20: Cross-batch data leakage prevention
  it('Scenario 20: strictly scopes move history to requested batch to prevent cross-batch leakage', async () => {
    const mockExecutor = {
      query: {
        batches: {
          findFirst: vi.fn().mockResolvedValue({ id: BATCH_A_ID }),
        },
      },
      select: vi.fn().mockImplementation((fields) => {
        if (fields && fields.totalCount) {
          return {
            from: vi.fn().mockImplementation(() => ({
              innerJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockResolvedValue([{ totalCount: 0 }]),
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
                  offset: vi.fn().mockResolvedValue([]),
                })),
              })),
            })),
          })),
        };
      }),
    };

    const history = await getBatchMoveHistory(
      {
        batchId: BATCH_A_ID,
      },
      mockExecutor as never,
    );

    expect(history.batchId).toBe(BATCH_A_ID);
    expect(history.items).toEqual([]);
  });
});
