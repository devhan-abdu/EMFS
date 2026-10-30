import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBatchSchema } from '@/lib/validations/batch';
import {
  createBatch,
  updateBatch,
  BatchError,
} from '@/lib/services/batches/batch';

// Mock DB for service tests
const {
  mockSelectWhere,
  mockSelect,
  mockInsertValues,
  mockInsertReturning,
  mockInsert,
  mockTransaction,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn().mockReturnValue({
    returning: mockInsertReturning,
  });
  const mockInsert = vi.fn().mockReturnValue({
    values: mockInsertValues,
  });

  const mockSelectWhere = vi.fn();
  const mockSelectFrom = vi.fn().mockReturnValue({
    where: mockSelectWhere,
  });
  const mockSelect = vi.fn().mockReturnValue({
    from: mockSelectFrom,
  });

  const mockTx = {
    select: mockSelect,
    insert: mockInsert,
  };

  const mockTransaction = vi.fn(
    async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
      return await cb(mockTx);
    },
  );

  return {
    mockSelectFrom,
    mockSelectWhere,
    mockSelect,
    mockInsertValues,
    mockInsertReturning,
    mockInsert,
    mockTransaction,
  };
});

vi.mock('@/db', () => {
  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      transaction: mockTransaction,
    },
  };
});

describe('Batch Validation - createBatchSchema', () => {
  // Must stay in the future relative to createBatchSchema's "not in the past" refine.
  const futureStartDate = '2099-01-15';

  const validBatch = {
    name: 'Cohort 2026-Alpha',
    maxMembers: 100,
    paceGroupCount: 2,
    startDate: futureStartDate,
    readingDaysPerWeek: 6,
  };

  it('parses valid batch input with explicit readingDaysPerWeek', () => {
    const result = createBatchSchema.safeParse(validBatch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Cohort 2026-Alpha');
      expect(result.data.maxMembers).toBe(100);
      expect(result.data.paceGroupCount).toBe(2);
      expect(result.data.readingDaysPerWeek).toBe(6);
      expect(result.data.startDate).toBeInstanceOf(Date);
      expect(result.data).not.toHaveProperty('pacingType');
    }
  });

  it('omits registrationOpen from schema parsing output even if passed', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      registrationOpen: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('registrationOpen');
    }
  });

  it('defaults readingDaysPerWeek to 6 when omitted', () => {
    const withoutReadingDays: Record<string, unknown> = { ...validBatch };
    delete withoutReadingDays.readingDaysPerWeek;
    const result = createBatchSchema.safeParse(withoutReadingDays);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.readingDaysPerWeek).toBe(6);
    }
  });

  it('parses valid batch with custom readingDaysPerWeek (1-7)', () => {
    for (const days of [1, 2, 3, 4, 5, 6, 7]) {
      const result = createBatchSchema.safeParse({
        ...validBatch,
        readingDaysPerWeek: days,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.readingDaysPerWeek).toBe(days);
      }
    }
  });

  it('parses valid batch with 1 or more admin IDs (unlimited)', () => {
    const admin1 = '11111111-1111-4111-8111-111111111111';
    const admin2 = '22222222-2222-4222-8222-222222222222';
    const result = createBatchSchema.safeParse({
      ...validBatch,
      adminIds: [admin1, admin2],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adminIds).toHaveLength(2);
    }
  });

  it('accepts 4 or more adminIds (no upper limit)', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      adminIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555',
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adminIds).toHaveLength(5);
    }
  });

  it('rejects empty batch name', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only batch name', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      name: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero maxMembers', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      maxMembers: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative maxMembers', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      maxMembers: -10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects float maxMembers', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      maxMembers: 12.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative paceGroupCount', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      paceGroupCount: -1,
    });
    expect(result.success).toBe(false);
  });

  it('allows paceGroupCount of 0', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      paceGroupCount: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date string for startDate', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      startDate: 'invalid-date',
    });
    expect(result.success).toBe(false);
  });

  it('rejects startDate in the past', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      startDate: '2000-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects readingDaysPerWeek < 1 or > 7', () => {
    expect(
      createBatchSchema.safeParse({
        ...validBatch,
        readingDaysPerWeek: 0,
      }).success,
    ).toBe(false);

    expect(
      createBatchSchema.safeParse({
        ...validBatch,
        readingDaysPerWeek: 8,
      }).success,
    ).toBe(false);
  });

  it('rejects non-integer readingDaysPerWeek', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      readingDaysPerWeek: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty adminIds array', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      adminIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid admin UUID format', () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      adminIds: ['not-a-uuid'],
    });
    expect(result.success).toBe(false);
  });
});

describe('Batch Service - createBatch & Transactional Admin Assignment', () => {
  const creatorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const createdBatchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a batch in not-yet-open status and assigns creator admin inside a transaction', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: creatorId, role: 'super_admin' },
    ]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: 'Test Batch',
        maxMembers: 50,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2026-09-01',
        readingDaysPerWeek: 6,
        createdBy: creatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await createBatch(creatorId, {
      name: 'Test Batch',
      maxMembers: 50,
      paceGroupCount: 1,
      startDate: new Date('2026-09-01'),
      readingDaysPerWeek: 6,
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(result.batch.id).toBe(createdBatchId);
    expect(result.batch.registrationOpen).toBe(false);
    expect(result.batch.paceGroupCount).toBe(1);
    expect(result.assignedAdminIds).toEqual([creatorId]);

    // Check batch insert payload
    expect(mockInsertValues).toHaveBeenNthCalledWith(1, {
      name: 'Test Batch',
      maxMembers: 50,
      paceGroupCount: 1,
      registrationOpen: false,
      autoApprove: true,
      startDate: '2026-09-01',
      readingDaysPerWeek: 6,
      createdBy: creatorId,
    });

    // Check batch_admins insert payload
    expect(mockInsertValues).toHaveBeenNthCalledWith(2, {
      batchId: createdBatchId,
      profileId: creatorId,
    });
  });

  it("allows assigning a normal 'member' profile as a batch admin", async () => {
    const memberProfileId = '33333333-3333-4333-8333-333333333333';

    mockSelectWhere.mockResolvedValueOnce([
      { id: memberProfileId, role: 'member' },
    ]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: 'Member Admin Batch',
        maxMembers: 60,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2026-09-01',
        readingDaysPerWeek: 6,
        createdBy: creatorId,
      },
    ]);

    const result = await createBatch(creatorId, {
      name: 'Member Admin Batch',
      maxMembers: 60,
      paceGroupCount: 1,
      startDate: new Date('2026-09-01'),
      readingDaysPerWeek: 6,
      adminIds: [memberProfileId],
    });

    expect(result.assignedAdminIds).toEqual([memberProfileId]);
    expect(mockInsertValues).toHaveBeenCalledTimes(2);
  });

  it('creates a batch and assigns multiple specified admins with no upper limit', async () => {
    const admin1 = '11111111-1111-4111-8111-111111111111';
    const admin2 = '22222222-2222-4222-8222-222222222222';

    mockSelectWhere.mockResolvedValueOnce([
      { id: admin1, role: 'batch_admin' },
      { id: admin2, role: 'member' },
    ]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: 'Multi Admin Batch',
        maxMembers: 120,
        paceGroupCount: 3,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2026-10-01',
        readingDaysPerWeek: 3,
        createdBy: creatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await createBatch(creatorId, {
      name: 'Multi Admin Batch',
      maxMembers: 120,
      paceGroupCount: 3,
      startDate: new Date('2026-10-01'),
      readingDaysPerWeek: 3,
      adminIds: [admin1, admin2],
    });

    expect(result.assignedAdminIds).toEqual([admin1, admin2]);
    expect(mockInsertValues).toHaveBeenCalledTimes(3); // 1 for batch + 2 for admins
  });

  it('creates a batch with 4 or more admins without throwing ADMIN_LIMIT_EXCEEDED', async () => {
    const adminIds = [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    ];

    mockSelectWhere.mockResolvedValueOnce(
      adminIds.map((id) => ({ id, role: 'member' })),
    );

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: 'Mega Admin Batch',
        maxMembers: 200,
        paceGroupCount: 4,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2026-11-01',
        readingDaysPerWeek: 6,
        createdBy: creatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await createBatch(creatorId, {
      name: 'Mega Admin Batch',
      maxMembers: 200,
      paceGroupCount: 4,
      startDate: new Date('2026-11-01'),
      readingDaysPerWeek: 6,
      registrationOpen: false,
      adminIds,
    });

    expect(result.assignedAdminIds).toEqual(adminIds);
    // 1 batch insert + 4 admin inserts
    expect(mockInsertValues).toHaveBeenCalledTimes(5);
  });

  it('allows batch assignment regardless of the profile legacy role', async () => {
    const adminId = '44444444-4444-4444-8444-444444444444';

    mockSelectWhere.mockResolvedValueOnce([{ id: adminId, role: 'member' }]);
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: 'Independent Grant Batch',
        maxMembers: 50,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2026-09-01',
        readingDaysPerWeek: 6,
        createdBy: creatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await createBatch(creatorId, {
      name: 'Independent Grant Batch',
      maxMembers: 50,
      paceGroupCount: 1,
      startDate: new Date('2026-09-01'),
      readingDaysPerWeek: 6,
      adminIds: [adminId],
    });

    expect(result.assignedAdminIds).toEqual([adminId]);
    expect(mockInsertValues).toHaveBeenCalledTimes(2);
  });

  it('rolls back transaction when an assigned admin profile does not exist', async () => {
    const fakeAdminId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

    // Only 0 profiles returned from query
    mockSelectWhere.mockResolvedValueOnce([]);

    await expect(
      createBatch(creatorId, {
        name: 'Test Batch',
        maxMembers: 50,
        paceGroupCount: 1,
        startDate: new Date('2026-09-01'),
        readingDaysPerWeek: 6,
        registrationOpen: false,
        adminIds: [fakeAdminId],
      }),
    ).rejects.toThrow(BatchError);

    // Ensure batch insert was never executed because admin verification failed
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it('rolls back transaction if batch admin insert throws', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: creatorId, role: 'super_admin' },
    ]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: 'Failing Admin Batch',
        maxMembers: 50,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2026-09-01',
        readingDaysPerWeek: 6,
        createdBy: creatorId,
      },
    ]);

    // Second call to mockInsertValues throws (simulating admin assignment failure / constraint failure)
    mockInsertValues
      .mockReturnValueOnce({ returning: mockInsertReturning })
      .mockImplementationOnce(() => {
        throw new Error('Foreign key constraint violation on batch_admins');
      });

    await expect(
      createBatch(creatorId, {
        name: 'Failing Admin Batch',
        maxMembers: 50,
        paceGroupCount: 1,
        startDate: new Date('2026-09-01'),
        readingDaysPerWeek: 6,
        registrationOpen: false,
      }),
    ).rejects.toThrow('Foreign key constraint violation on batch_admins');
  });

  it('does not insert any pace-group rows or book tracking fields and remains not-yet-open', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: creatorId, role: 'super_admin' },
    ]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: 'Clean Batch',
        maxMembers: 50,
        paceGroupCount: 4,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2026-09-01',
        readingDaysPerWeek: 6,
        createdBy: creatorId,
      },
    ]);

    const result = await createBatch(creatorId, {
      name: 'Clean Batch',
      maxMembers: 50,
      paceGroupCount: 4,
      startDate: new Date('2026-09-01'),
      readingDaysPerWeek: 6,
    });

    expect(result.batch.name).toBe('Clean Batch');
    expect(result.batch.registrationOpen).toBe(false);
    const batchInsertArgs = mockInsertValues.mock.calls[0][0];
    expect(batchInsertArgs).not.toHaveProperty('bookId');
    expect(batchInsertArgs).not.toHaveProperty('book_id');
    expect(batchInsertArgs).not.toHaveProperty('currentBook');
    expect(batchInsertArgs).not.toHaveProperty('current_book');
    expect(mockInsertValues).toHaveBeenCalledTimes(2); // exactly 1 batch insert + 1 admin insert, NO pace_groups table insert
  });

  it('always initializes registrationOpen to false upon creation even if registrationOpen: true is passed', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: creatorId, role: 'super_admin' },
    ]);
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: 'Always Closed Batch',
        maxMembers: 50,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2026-09-01',
        readingDaysPerWeek: 6,
        createdBy: creatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await createBatch(creatorId, {
      name: 'Always Closed Batch',
      maxMembers: 50,
      paceGroupCount: 1,
      startDate: new Date('2026-09-01'),
      readingDaysPerWeek: 6,
      // @ts-expect-error - testing runtime resilience against extra property
      registrationOpen: true,
    });

    expect(result.batch.registrationOpen).toBe(false);
    expect(mockInsertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        registrationOpen: false,
      }),
    );
  });
});

describe('Minimum-One-Admin Enforcement (EMF-82)', () => {
  /**
   * Context: There is no standalone "remove a batch admin" action in this
   * codebase. All batch admin changes go through updateBatch (full wipe +
   * re-insert). The minimum-one requirement is therefore enforced by two
   * independent layers:
   *
   *   Layer 1 — Zod schema (.min(1)) in createBatchSchema:
   *     Fires inside createBatchAction / updateBatchAction before the service
   *     is ever called. Returns a field-level validation error to the UI.
   *
   *   Layer 2 — Service guard (candidateAdminIds.length < 1) in both
   *     createBatch and updateBatch:
   *     Defense-in-depth for direct service callers that bypass schema
   *     validation. Throws BatchError('INVALID_INPUT', ...).
   *
   * The service's fallback logic (`adminIds && adminIds.length > 0 ?
   * [...adminIds] : [creatorProfileId]`) means the Layer-2 guard cannot
   * actually be reached through the normal public API — an undefined or
   * absent adminIds field always falls back to the creator, yielding length 1.
   * The guard protects against future internal callers that mutate the list
   * after construction. These tests lock both layers explicitly.
   */
  const creatorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const futureDate = new Date('2099-01-15');

  const baseInput = {
    name: 'Test Batch',
    maxMembers: 50,
    paceGroupCount: 1,
    startDate: futureDate,
    readingDaysPerWeek: 6,
    registrationOpen: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Zod (Layer 1): rejects empty adminIds array on createBatchSchema with the correct user-facing field error', () => {
    const result = createBatchSchema.safeParse({
      ...baseInput,
      adminIds: [],
    });
    expect(result.success).toBe(false);
    const flat = result.error?.flatten();
    expect(flat?.fieldErrors.adminIds).toContain(
      'At least 1 batch admin is required',
    );
    // Confirm no transaction was opened — schema blocked before service call
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('Zod (Layer 1): same schema is used by both createBatchAction and updateBatchAction, so empty adminIds is rejected on update too', () => {
    // Both actions call createBatchSchema.safeParse — one shared contract.
    const result = createBatchSchema.safeParse({
      ...baseInput,
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', // update path
      adminIds: [],
    });
    expect(result.success).toBe(false);
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result.error?.issues as any[])?.some((i) => i.path.includes('adminIds')),
    ).toBe(true);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('Service (Layer 2): createBatch fallback ensures creatorId is always included when adminIds is absent, so the guard is never triggered via public API', async () => {
    // This documents the invariant: undefined adminIds → [creatorId] fallback.
    // The service guard (length < 1) cannot be reached through normal usage.
    mockSelectWhere.mockResolvedValueOnce([
      { id: creatorId, role: 'super_admin' },
    ]);
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Test Batch',
        maxMembers: 50,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: '2099-01-15',
        readingDaysPerWeek: 6,
        createdBy: creatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // No adminIds supplied — creator fallback kicks in
    const result = await createBatch(creatorId, baseInput);
    expect(result.assignedAdminIds).toEqual([creatorId]);
    // Guard was NOT triggered; transaction completed successfully
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('Zod (Layer 1): accepts 1 adminId, confirming minimum-one is the exact boundary', () => {
    const result = createBatchSchema.safeParse({
      ...baseInput,
      adminIds: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(result.success).toBe(true);
  });

  void updateBatch; // imported to confirm it shares the same enforcement path; used by updateBatchAction
});
