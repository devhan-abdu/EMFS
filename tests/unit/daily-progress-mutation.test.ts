import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRequireSession,
  mockFindFirstBatchMembership,
  mockFindManyPaceGroupMemberships,
  mockFindFirstBatch,
  mockFindFirstPaceGroup,
  mockFindFirstTask,
  mockFindFirstBook,
  mockFindManyOffsets,
  mockFindFirstDailyProgress,
  mockInsert,
  mockInsertValues,
  mockOnConflictDoUpdate,
  mockReturning,
  mockTx,
} = vi.hoisted(() => {
  const mockRequireSession = vi.fn();
  const mockFindFirstBatchMembership = vi.fn();
  const mockFindManyPaceGroupMemberships = vi.fn();
  const mockFindFirstBatch = vi.fn();
  const mockFindFirstPaceGroup = vi.fn();
  const mockFindFirstTask = vi.fn();
  const mockFindFirstBook = vi.fn();
  const mockFindManyOffsets = vi.fn();
  const mockFindFirstDailyProgress = vi.fn();

  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockTx = {
    query: {
      batchMemberships: { findFirst: mockFindFirstBatchMembership },
      paceGroupMemberships: { findMany: mockFindManyPaceGroupMemberships },
      batches: { findFirst: mockFindFirstBatch },
      paceGroups: { findFirst: mockFindFirstPaceGroup },
      tasks: { findFirst: mockFindFirstTask },
      books: { findFirst: mockFindFirstBook },
      batchPacingOffsets: { findMany: mockFindManyOffsets },
      dailyProgress: { findFirst: mockFindFirstDailyProgress },
    },
    insert: mockInsert,
  };

  return {
    mockRequireSession,
    mockFindFirstBatchMembership,
    mockFindManyPaceGroupMemberships,
    mockFindFirstBatch,
    mockFindFirstPaceGroup,
    mockFindFirstTask,
    mockFindFirstBook,
    mockFindManyOffsets,
    mockFindFirstDailyProgress,
    mockInsert,
    mockInsertValues,
    mockOnConflictDoUpdate,
    mockReturning,
    mockTx,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/authorize", () => ({
  requireSession: mockRequireSession,
  AuthzError: class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      batchMemberships: { findFirst: mockFindFirstBatchMembership },
      paceGroupMemberships: { findMany: mockFindManyPaceGroupMemberships },
      batches: { findFirst: mockFindFirstBatch },
      paceGroups: { findFirst: mockFindFirstPaceGroup },
      tasks: { findFirst: mockFindFirstTask },
      books: { findFirst: mockFindFirstBook },
      batchPacingOffsets: { findMany: mockFindManyOffsets },
      dailyProgress: { findFirst: mockFindFirstDailyProgress },
    },
    insert: mockInsert,
    transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
      cb(mockTx),
    ),
  },
}));

import {
  recordDailyProgressForProfile,
  recordDailyProgress,
  getDailyProgressForProfile,
  DailyProgressError,
} from "@/lib/services/daily-progress";
import { AuthzError } from "@/lib/auth/authorize";

describe("Daily Progress Mutation Service - Idempotency, Concurrency & Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validProfileId = "550e8400-e29b-41d4-a716-446655440001";
  const validTaskId = "550e8400-e29b-41d4-a716-446655440002";
  const validBookId = "550e8400-e29b-41d4-a716-446655440003";
  const validBatchId = "550e8400-e29b-41d4-a716-446655440004";
  const validPaceGroupId = "550e8400-e29b-41d4-a716-446655440005";

  const sessionUser = {
    authUserId: "auth-user-1",
    email: "member@example.com",
    profile: {
      id: validProfileId,
      authUserId: "auth-user-1",
      role: "member" as const,
      firstName: "Alicia",
      fatherName: "Johnson",
      grandfatherName: null,
      telegramUsername: "@alicia",
      phone: "+15550101",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  function setupValidDbMocks(overrides?: {
    batchStartDate?: string | null;
    taskDayNumber?: number;
    offsets?: Array<{ effectiveFromDayNumber: number; offsetDays: number }>;
  }) {
    mockFindFirstBatchMembership.mockResolvedValue({
      id: "bm-1",
      profileId: validProfileId,
      batchId: validBatchId,
      status: "active",
    });
    mockFindFirstBatch.mockResolvedValue({
      id: validBatchId,
      name: "Batch Alpha",
      startDate:
        overrides?.batchStartDate !== undefined
          ? overrides.batchStartDate
          : "2026-01-15",
      readingDaysPerWeek: 6,
    });
    mockFindManyPaceGroupMemberships.mockResolvedValue([
      {
        id: "pgm-1",
        profileId: validProfileId,
        paceGroupId: validPaceGroupId,
        status: "active",
      },
    ]);
    mockFindFirstPaceGroup.mockResolvedValue({
      id: validPaceGroupId,
      batchId: validBatchId,
      name: "Group A",
      size: 10,
    });
    mockFindFirstTask.mockResolvedValue({
      id: validTaskId,
      bookId: validBookId,
      dayNumber: overrides?.taskDayNumber ?? 1,
      content: "Read chapter 1",
    });
    mockFindFirstBook.mockResolvedValue({
      id: validBookId,
      title: "The Hobbit",
      language: "en",
      sequenceOrder: 1,
    });
    mockFindManyOffsets.mockResolvedValue(overrides?.offsets ?? []);
  }

  it("1. First DONE creates progress record with status 'done' and completedAt timestamp", async () => {
    setupValidDbMocks();
    mockFindFirstDailyProgress.mockResolvedValue(undefined); // No prior record

    const createdRecord = {
      id: "dp-1",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "done" as const,
      completedAt: new Date("2026-01-15T10:00:00.000Z"),
      createdAt: new Date("2026-01-15T10:00:00.000Z"),
      updatedAt: new Date("2026-01-15T10:00:00.000Z"),
    };
    mockReturning.mockResolvedValue([createdRecord]);

    const result = await recordDailyProgressForProfile(
      validProfileId,
      { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
      mockTx as any,
    );

    expect(result.previousStatus).toBeNull();
    expect(result.statusChanged).toBe(true);
    expect(result.progress.status).toBe("done");
    expect(result.progress.completedAt).toBeDefined();

    // Verify insert values
    const insertCall = mockInsertValues.mock.calls[0][0];
    expect(insertCall.profileId).toBe(validProfileId);
    expect(insertCall.batchId).toBe(validBatchId);
    expect(insertCall.paceGroupId).toBe(validPaceGroupId);
    expect(insertCall.taskId).toBe(validTaskId);
    expect(insertCall.status).toBe("done");
    expect(insertCall.completedAt).toBeInstanceOf(Date);
  });

  it("2. Repeated DONE (DONE -> DONE) is idempotent, statusChanged is false, and preserves completedAt", async () => {
    setupValidDbMocks();
    const originalCompletedAt = new Date("2026-01-15T09:00:00.000Z");
    mockFindFirstDailyProgress.mockResolvedValue({
      id: "dp-1",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "done",
      completedAt: originalCompletedAt,
      createdAt: originalCompletedAt,
      updatedAt: originalCompletedAt,
    });

    const updatedRecord = {
      id: "dp-1",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "done" as const,
      completedAt: originalCompletedAt,
      createdAt: originalCompletedAt,
      updatedAt: new Date("2026-01-15T11:00:00.000Z"),
    };
    mockReturning.mockResolvedValue([updatedRecord]);

    const result = await recordDailyProgressForProfile(
      validProfileId,
      { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
      mockTx as any,
    );

    expect(result.previousStatus).toBe("done");
    expect(result.statusChanged).toBe(false);
    expect(result.progress.status).toBe("done");
    expect(result.progress.completedAt).toEqual(originalCompletedAt);

    // Verify insert payload preserves original completedAt
    const insertCall = mockInsertValues.mock.calls[0][0];
    expect(insertCall.completedAt).toEqual(originalCompletedAt);
  });

  it("3. First NOT_DONE creates progress record with status 'not_done' and completedAt null", async () => {
    setupValidDbMocks();
    mockFindFirstDailyProgress.mockResolvedValue(undefined);

    const createdRecord = {
      id: "dp-2",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "not_done" as const,
      completedAt: null,
      createdAt: new Date("2026-01-15T10:00:00.000Z"),
      updatedAt: new Date("2026-01-15T10:00:00.000Z"),
    };
    mockReturning.mockResolvedValue([createdRecord]);

    const result = await recordDailyProgressForProfile(
      validProfileId,
      { taskId: validTaskId, status: "not_done", localDate: "2026-01-15" },
      mockTx as any,
    );

    expect(result.previousStatus).toBeNull();
    expect(result.statusChanged).toBe(true);
    expect(result.progress.status).toBe("not_done");
    expect(result.progress.completedAt).toBeNull();

    const insertCall = mockInsertValues.mock.calls[0][0];
    expect(insertCall.completedAt).toBeNull();
  });

  it("4. Repeated NOT_DONE (NOT_DONE -> NOT_DONE) is idempotent and statusChanged is false", async () => {
    setupValidDbMocks();
    mockFindFirstDailyProgress.mockResolvedValue({
      id: "dp-2",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "not_done",
      completedAt: null,
      createdAt: new Date("2026-01-15T09:00:00.000Z"),
      updatedAt: new Date("2026-01-15T09:00:00.000Z"),
    });

    const updatedRecord = {
      id: "dp-2",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "not_done" as const,
      completedAt: null,
      createdAt: new Date("2026-01-15T09:00:00.000Z"),
      updatedAt: new Date("2026-01-15T11:00:00.000Z"),
    };
    mockReturning.mockResolvedValue([updatedRecord]);

    const result = await recordDailyProgressForProfile(
      validProfileId,
      { taskId: validTaskId, status: "not_done", localDate: "2026-01-15" },
      mockTx as any,
    );

    expect(result.previousStatus).toBe("not_done");
    expect(result.statusChanged).toBe(false);
    expect(result.progress.status).toBe("not_done");
    expect(result.progress.completedAt).toBeNull();
  });

  it("5. DONE -> NOT_DONE toggles status and resets completedAt to null", async () => {
    setupValidDbMocks();
    mockFindFirstDailyProgress.mockResolvedValue({
      id: "dp-1",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "done",
      completedAt: new Date("2026-01-15T08:00:00.000Z"),
      createdAt: new Date("2026-01-15T08:00:00.000Z"),
      updatedAt: new Date("2026-01-15T08:00:00.000Z"),
    });

    const updatedRecord = {
      id: "dp-1",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "not_done" as const,
      completedAt: null,
      createdAt: new Date("2026-01-15T08:00:00.000Z"),
      updatedAt: new Date("2026-01-15T12:00:00.000Z"),
    };
    mockReturning.mockResolvedValue([updatedRecord]);

    const result = await recordDailyProgressForProfile(
      validProfileId,
      { taskId: validTaskId, status: "not_done", localDate: "2026-01-15" },
      mockTx as any,
    );

    expect(result.previousStatus).toBe("done");
    expect(result.statusChanged).toBe(true);
    expect(result.progress.status).toBe("not_done");
    expect(result.progress.completedAt).toBeNull();

    const insertCall = mockInsertValues.mock.calls[0][0];
    expect(insertCall.completedAt).toBeNull();
  });

  it("6. Concurrency safety: uses ON CONFLICT (profileId, taskId) DO UPDATE", async () => {
    setupValidDbMocks();
    mockFindFirstDailyProgress.mockResolvedValue(undefined);

    const record = {
      id: "dp-1",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "done" as const,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReturning.mockResolvedValue([record]);

    await recordDailyProgressForProfile(
      validProfileId,
      { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
      mockTx as any,
    );

    // Verify that ON CONFLICT DO UPDATE was configured for the unique index target
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    const onConflictConfig = mockOnConflictDoUpdate.mock.calls[0][0];
    expect(onConflictConfig.target).toBeDefined();
    expect(onConflictConfig.set).toBeDefined();
    expect(onConflictConfig.set.status).toBe("done");
  });

  it("7. High-level recordDailyProgress rejects unauthenticated requests", async () => {
    mockRequireSession.mockRejectedValue(
      new AuthzError("UNAUTHENTICATED", "You must be signed in."),
    );

    await expect(
      recordDailyProgress(
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toThrow(AuthzError);
  });

  it("8. Rejects mutation when member has inactive batch", async () => {
    setupValidDbMocks();
    mockFindFirstBatchMembership.mockResolvedValue(undefined);

    await expect(
      recordDailyProgressForProfile(
        validProfileId,
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_BATCH",
    });
  });

  it("9. Rejects mutation when member has inactive pace-group membership", async () => {
    setupValidDbMocks();
    mockFindManyPaceGroupMemberships.mockResolvedValue([]);

    await expect(
      recordDailyProgressForProfile(
        validProfileId,
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_PACE_GROUP",
    });
  });

  it("10. Rejects mutation when pace group belongs to another batch", async () => {
    setupValidDbMocks();
    mockFindManyPaceGroupMemberships.mockResolvedValue([
      {
        id: "pgm-1",
        profileId: validProfileId,
        paceGroupId: "group-other-batch",
        status: "active",
      },
    ]);
    mockFindFirstPaceGroup.mockResolvedValue(undefined);

    await expect(
      recordDailyProgressForProfile(
        validProfileId,
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_PACE_GROUP",
    });
  });

  it("11. Rejects mutation when task is unpublished (future day step)", async () => {
    // Task is step 10, scheduled for Jan 26, but localDate is Jan 15
    setupValidDbMocks({ batchStartDate: "2026-01-15", taskDayNumber: 10 });

    await expect(
      recordDailyProgressForProfile(
        validProfileId,
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "TASK_NOT_PUBLISHED",
    });
  });

  it("12. Rejects mutation when batch has not started yet", async () => {
    setupValidDbMocks({ batchStartDate: "2026-02-01" });

    await expect(
      recordDailyProgressForProfile(
        validProfileId,
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "BATCH_NOT_STARTED",
    });
  });

  it("13. Queries daily progress using getDailyProgressForProfile helper", async () => {
    const existing = {
      id: "dp-1",
      profileId: validProfileId,
      batchId: validBatchId,
      paceGroupId: validPaceGroupId,
      taskId: validTaskId,
      status: "done" as const,
      completedAt: new Date("2026-01-15T10:00:00.000Z"),
      createdAt: new Date("2026-01-15T10:00:00.000Z"),
      updatedAt: new Date("2026-01-15T10:00:00.000Z"),
    };
    mockFindFirstDailyProgress.mockResolvedValue(existing);

    const result = await getDailyProgressForProfile(
      validProfileId,
      validTaskId,
      mockTx as any,
    );

    expect(result).toEqual(existing);
  });
});
