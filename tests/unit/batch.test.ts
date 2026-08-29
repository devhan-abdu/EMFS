import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBatchSchema,
  assignBatchAdminSchema,
  assignBatchAdminsSchema,
} from "@/lib/validations/batch";
import {
  createBatch,
  assignBatchAdmin,
  getBatchAdmins,
  resolveReadingDaysPerWeek,
  BatchError,
} from "@/lib/services/batch";


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
    }
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

vi.mock("@/db", () => {
  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      transaction: mockTransaction,
    },
  };
});

describe("Batch Validation - createBatchSchema", () => {
  const validBatch = {
    name: "Cohort 2026-Alpha",
    maxMembers: 100,
    paceGroupCount: 2,
    startDate: "2026-09-01",
    pacingType: "daily" as const,
  };

  it("parses valid daily pacing batch input", () => {
    const result = createBatchSchema.safeParse(validBatch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Cohort 2026-Alpha");
      expect(result.data.maxMembers).toBe(100);
      expect(result.data.paceGroupCount).toBe(2);
      expect(result.data.pacingType).toBe("daily");
      expect(result.data.startDate).toBeInstanceOf(Date);
    }
  });

  it("parses valid three_times_week pacing batch input", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      pacingType: "three_times_week",
    });
    expect(result.success).toBe(true);
  });

  it("parses valid custom pacing batch input with readingDaysPerWeek", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      pacingType: "custom",
      readingDaysPerWeek: 4,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.readingDaysPerWeek).toBe(4);
    }
  });

  it("parses valid batch with 1-3 admin IDs", () => {
    const admin1 = "11111111-1111-4111-8111-111111111111";
    const admin2 = "22222222-2222-4222-8222-222222222222";
    const result = createBatchSchema.safeParse({
      ...validBatch,
      adminIds: [admin1, admin2],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adminIds).toHaveLength(2);
    }
  });

  it("rejects empty batch name", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only batch name", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      name: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero maxMembers", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      maxMembers: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative maxMembers", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      maxMembers: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects float maxMembers", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      maxMembers: 12.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects paceGroupCount less than 1", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      paceGroupCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date string for startDate", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      startDate: "invalid-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid pacingType", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      pacingType: "monthly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects readingDaysPerWeek < 1 or > 7", () => {
    expect(
      createBatchSchema.safeParse({
        ...validBatch,
        pacingType: "custom",
        readingDaysPerWeek: 0,
      }).success
    ).toBe(false);

    expect(
      createBatchSchema.safeParse({
        ...validBatch,
        pacingType: "custom",
        readingDaysPerWeek: 8,
      }).success
    ).toBe(false);
  });

  it("rejects empty adminIds array", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      adminIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 adminIds", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      adminIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid admin UUID format", () => {
    const result = createBatchSchema.safeParse({
      ...validBatch,
      adminIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });
});

describe("resolveReadingDaysPerWeek", () => {
  it("maps daily to 7", () => {
    expect(resolveReadingDaysPerWeek("daily")).toBe(7);
  });

  it("maps three_times_week to 3", () => {
    expect(resolveReadingDaysPerWeek("three_times_week")).toBe(3);
  });

  it("maps custom to provided custom reading days or default 6", () => {
    expect(resolveReadingDaysPerWeek("custom", 5)).toBe(5);
    expect(resolveReadingDaysPerWeek("custom")).toBe(6);
  });
});

describe("Batch Service - createBatch & Transactional Admin Assignment", () => {
  const creatorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const createdBatchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a batch in not-yet-open status and assigns the creator admin inside a transaction", async () => {
    mockSelectWhere.mockResolvedValueOnce([{ id: creatorId }]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: "Test Batch",
        maxMembers: 50,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: "2026-09-01",
        readingDaysPerWeek: 7,
        createdBy: creatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await createBatch(creatorId, {
      name: "Test Batch",
      maxMembers: 50,
      paceGroupCount: 1,
      startDate: new Date("2026-09-01"),
      pacingType: "daily",
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(result.batch.id).toBe(createdBatchId);
    expect(result.batch.registrationOpen).toBe(false);
    expect(result.batch.paceGroupCount).toBe(1);
    expect(result.assignedAdminIds).toEqual([creatorId]);

    // Check batch insert payload
    expect(mockInsertValues).toHaveBeenNthCalledWith(1, {
      name: "Test Batch",
      maxMembers: 50,
      paceGroupCount: 1,
      registrationOpen: false,
      autoApprove: true,
      startDate: "2026-09-01",
      readingDaysPerWeek: 7,
      createdBy: creatorId,
    });

    // Check batch_admins insert payload
    expect(mockInsertValues).toHaveBeenNthCalledWith(2, {
      batchId: createdBatchId,
      profileId: creatorId,
    });
  });

  it("creates a batch and assigns multiple (1-3) specified admins", async () => {
    const admin1 = "11111111-1111-4111-8111-111111111111";
    const admin2 = "22222222-2222-4222-8222-222222222222";

    mockSelectWhere.mockResolvedValueOnce([{ id: admin1 }, { id: admin2 }]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: "Multi Admin Batch",
        maxMembers: 120,
        paceGroupCount: 3,
        registrationOpen: false,
        autoApprove: true,
        startDate: "2026-10-01",
        readingDaysPerWeek: 3,
        createdBy: creatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await createBatch(creatorId, {
      name: "Multi Admin Batch",
      maxMembers: 120,
      paceGroupCount: 3,
      startDate: new Date("2026-10-01"),
      pacingType: "three_times_week",
      adminIds: [admin1, admin2],
    });

    expect(result.assignedAdminIds).toEqual([admin1, admin2]);
    expect(mockInsertValues).toHaveBeenCalledTimes(3); // 1 for batch + 2 for admins
  });

  it("rolls back transaction when an assigned admin profile does not exist", async () => {
    const fakeAdminId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

    // Only 0 profiles returned from query
    mockSelectWhere.mockResolvedValueOnce([]);

    await expect(
      createBatch(creatorId, {
        name: "Test Batch",
        maxMembers: 50,
        paceGroupCount: 1,
        startDate: new Date("2026-09-01"),
        pacingType: "daily",
        adminIds: [fakeAdminId],
      })
    ).rejects.toThrow(BatchError);

    // Ensure batch insert was never executed because admin verification failed
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it("rolls back transaction if batch admin insert throws", async () => {
    mockSelectWhere.mockResolvedValueOnce([{ id: creatorId }]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: "Failing Admin Batch",
        maxMembers: 50,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: "2026-09-01",
        readingDaysPerWeek: 7,
        createdBy: creatorId,
      },
    ]);

    // Second call to mockInsertValues throws (simulating admin assignment failure / constraint failure)
    mockInsertValues
      .mockReturnValueOnce({ returning: mockInsertReturning })
      .mockImplementationOnce(() => {
        throw new Error("Foreign key constraint violation on batch_admins");
      });

    await expect(
      createBatch(creatorId, {
        name: "Failing Admin Batch",
        maxMembers: 50,
        paceGroupCount: 1,
        startDate: new Date("2026-09-01"),
        pacingType: "daily",
      })
    ).rejects.toThrow("Foreign key constraint violation on batch_admins");
  });

  it("does not insert any pace-group rows or book tracking fields", async () => {
    mockSelectWhere.mockResolvedValueOnce([{ id: creatorId }]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: createdBatchId,
        name: "Clean Batch",
        maxMembers: 50,
        paceGroupCount: 4,
        registrationOpen: false,
        autoApprove: true,
        startDate: "2026-09-01",
        readingDaysPerWeek: 7,
        createdBy: creatorId,
      },
    ]);

    const result = await createBatch(creatorId, {
      name: "Clean Batch",
      maxMembers: 50,
      paceGroupCount: 4,
      startDate: new Date("2026-09-01"),
      pacingType: "daily",
    });

    expect(result.batch.name).toBe("Clean Batch");
    const batchInsertArgs = mockInsertValues.mock.calls[0][0];
    expect(batchInsertArgs).not.toHaveProperty("bookId");
    expect(batchInsertArgs).not.toHaveProperty("book_id");
    expect(batchInsertArgs).not.toHaveProperty("currentBook");
    expect(batchInsertArgs).not.toHaveProperty("current_book");
    expect(mockInsertValues).toHaveBeenCalledTimes(2); // exactly 1 batch insert + 1 admin insert, NO pace_groups table insert
  });

  it("rejects batch creation when duplicate admin IDs are provided", async () => {
    const admin1 = "11111111-1111-4111-8111-111111111111";

    await expect(
      createBatch(creatorId, {
        name: "Duplicate Admin Batch",
        maxMembers: 50,
        paceGroupCount: 1,
        startDate: new Date("2026-09-01"),
        pacingType: "daily",
        adminIds: [admin1, admin1],
      })
    ).rejects.toThrow(BatchError);
  });

  it("rejects batch creation when maxMembers <= 0", async () => {
    await expect(
      createBatch(creatorId, {
        name: "Invalid Max Members Batch",
        maxMembers: 0,
        paceGroupCount: 1,
        startDate: new Date("2026-09-01"),
        pacingType: "daily",
      })
    ).rejects.toThrow(BatchError);
  });

  it("rejects batch creation when paceGroupCount < 1", async () => {
    await expect(
      createBatch(creatorId, {
        name: "Invalid Pace Group Count Batch",
        maxMembers: 50,
        paceGroupCount: 0,
        startDate: new Date("2026-09-01"),
        pacingType: "daily",
      })
    ).rejects.toThrow(BatchError);
  });
});

describe("Batch Admin Validation - assignBatchAdminSchema & assignBatchAdminsSchema", () => {
  const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const profileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const adminId2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("parses valid batchId and profileId", () => {
    const result = assignBatchAdminSchema.safeParse({
      batchId,
      profileId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.batchId).toBe(batchId);
      expect(result.data.profileId).toBe(profileId);
    }
  });

  it("parses valid batchId and adminId (aliasing to profileId)", () => {
    const result = assignBatchAdminSchema.safeParse({
      batchId,
      adminId: profileId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.batchId).toBe(batchId);
      expect(result.data.profileId).toBe(profileId);
    }
  });

  it("rejects invalid batch UUID", () => {
    const result = assignBatchAdminSchema.safeParse({
      batchId: "invalid-batch-uuid",
      profileId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid profile UUID", () => {
    const result = assignBatchAdminSchema.safeParse({
      batchId,
      profileId: "invalid-profile-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when both profileId and adminId are missing", () => {
    const result = assignBatchAdminSchema.safeParse({
      batchId,
    });
    expect(result.success).toBe(false);
  });

  it("createBatchSchema rejects duplicate adminIds", () => {
    const result = createBatchSchema.safeParse({
      name: "Cohort 2026",
      maxMembers: 50,
      paceGroupCount: 1,
      startDate: "2026-09-01",
      pacingType: "daily",
      adminIds: [profileId, profileId],
    });
    expect(result.success).toBe(false);
  });

  it("assignBatchAdminsSchema parses valid admin IDs and rejects duplicates", () => {
    const valid = assignBatchAdminsSchema.safeParse({
      batchId,
      adminIds: [profileId, adminId2],
    });
    expect(valid.success).toBe(true);

    const duplicate = assignBatchAdminsSchema.safeParse({
      batchId,
      adminIds: [profileId, profileId],
    });
    expect(duplicate.success).toBe(false);
  });
});

describe("Batch Service - assignBatchAdmin", () => {
  const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const existingAdmin1 = "11111111-1111-4111-8111-111111111111";
  const existingAdmin2 = "22222222-2222-4222-8222-222222222222";
  const existingAdmin3 = "33333333-3333-4333-8333-333333333333";
  const newAdmin = "44444444-4444-4444-8444-444444444444";

  const validBatchRecord = {
    id: batchId,
    name: "Active Cohort",
    maxMembers: 100,
    paceGroupCount: 2,
    registrationOpen: false,
    autoApprove: true,
    startDate: "2026-09-01",
    readingDaysPerWeek: 7,
    createdBy: existingAdmin1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully assigns a new admin to a batch with existing admins (< 3)", async () => {
    // 1. Batch lookup
    mockSelectWhere.mockResolvedValueOnce([validBatchRecord]);
    // 2. Profile lookup
    mockSelectWhere.mockResolvedValueOnce([{ id: newAdmin }]);
    // 3. Existing admins lookup (currently 1 admin)
    mockSelectWhere.mockResolvedValueOnce([{ profileId: existingAdmin1 }]);

    const result = await assignBatchAdmin(batchId, newAdmin);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(result.batchId).toBe(batchId);
    expect(result.profileId).toBe(newAdmin);
    expect(result.assignedAdminIds).toEqual([existingAdmin1, newAdmin]);

    expect(mockInsertValues).toHaveBeenCalledWith({
      batchId,
      profileId: newAdmin,
    });
  });

  it("rejects duplicate admin assignment when user is already assigned to the batch", async () => {
    // 1. Batch lookup
    mockSelectWhere.mockResolvedValueOnce([validBatchRecord]);
    // 2. Profile lookup
    mockSelectWhere.mockResolvedValueOnce([{ id: existingAdmin1 }]);
    // 3. Existing admins lookup (existingAdmin1 is already assigned)
    mockSelectWhere.mockResolvedValueOnce([{ profileId: existingAdmin1 }]);

    await expect(assignBatchAdmin(batchId, existingAdmin1)).rejects.toThrow(
      new BatchError(
        "DUPLICATE_ADMIN",
        "The same user cannot be assigned to the same batch more than once."
      )
    );

    // Ensure insert was not called
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects 4th admin assignment with a clear error when batch already has 3 admins", async () => {
    // 1. Batch lookup
    mockSelectWhere.mockResolvedValueOnce([validBatchRecord]);
    // 2. Profile lookup
    mockSelectWhere.mockResolvedValueOnce([{ id: newAdmin }]);
    // 3. Existing admins lookup (already 3 admins)
    mockSelectWhere.mockResolvedValueOnce([
      { profileId: existingAdmin1 },
      { profileId: existingAdmin2 },
      { profileId: existingAdmin3 },
    ]);

    await expect(assignBatchAdmin(batchId, newAdmin)).rejects.toThrow(
      new BatchError(
        "ADMIN_LIMIT_EXCEEDED",
        "A batch cannot have more than 3 assigned batch admins. 4th admin assignment is rejected."
      )
    );

    // Must not be silently ignored and must not insert
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects admin assignment when batch does not exist", async () => {
    // Batch lookup returns empty
    mockSelectWhere.mockResolvedValueOnce([]);

    await expect(assignBatchAdmin(batchId, newAdmin)).rejects.toThrow(
      new BatchError("BATCH_NOT_FOUND", "Batch not found.")
    );

    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects admin assignment when target profile does not exist", async () => {
    // 1. Batch lookup returns batch
    mockSelectWhere.mockResolvedValueOnce([validBatchRecord]);
    // 2. Profile lookup returns empty
    mockSelectWhere.mockResolvedValueOnce([]);

    await expect(assignBatchAdmin(batchId, newAdmin)).rejects.toThrow(
      new BatchError("ADMIN_NOT_FOUND", `Admin profile not found: ${newAdmin}`)
    );

    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects admin assignment when batch maxMembers <= 0", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      {
        ...validBatchRecord,
        maxMembers: 0,
      },
    ]);

    await expect(assignBatchAdmin(batchId, newAdmin)).rejects.toThrow(
      new BatchError(
        "INVALID_INPUT",
        "Batch max_members must be greater than 0."
      )
    );

    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects admin assignment when batch paceGroupCount < 1", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      {
        ...validBatchRecord,
        paceGroupCount: 0,
      },
    ]);

    await expect(assignBatchAdmin(batchId, newAdmin)).rejects.toThrow(
      new BatchError(
        "INVALID_INPUT",
        "Batch pace_group_count must be at least 1."
      )
    );

    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("getBatchAdmins returns list of assigned profile IDs", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { profileId: existingAdmin1 },
      { profileId: existingAdmin2 },
    ]);

    const admins = await getBatchAdmins(batchId);
    expect(admins).toEqual([existingAdmin1, existingAdmin2]);
  });
});

