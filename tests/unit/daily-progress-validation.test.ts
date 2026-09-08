/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindFirstBatchMembership,
  mockFindManyPaceGroupMemberships,
  mockFindFirstBatch,
  mockFindFirstPaceGroup,
  mockFindFirstTask,
  mockFindFirstBook,
  mockFindManyOffsets,
  mockTx,
} = vi.hoisted(() => {
  const mockFindFirstBatchMembership = vi.fn();
  const mockFindManyPaceGroupMemberships = vi.fn();
  const mockFindFirstBatch = vi.fn();
  const mockFindFirstPaceGroup = vi.fn();
  const mockFindFirstTask = vi.fn();
  const mockFindFirstBook = vi.fn();
  const mockFindManyOffsets = vi.fn();

  const mockTx = {
    query: {
      batchMemberships: { findFirst: mockFindFirstBatchMembership },
      paceGroupMemberships: { findMany: mockFindManyPaceGroupMemberships },
      batches: { findFirst: mockFindFirstBatch },
      paceGroups: { findFirst: mockFindFirstPaceGroup },
      tasks: { findFirst: mockFindFirstTask },
      books: { findFirst: mockFindFirstBook },
      batchPacingOffsets: { findMany: mockFindManyOffsets },
    },
  };

  return {
    mockFindFirstBatchMembership,
    mockFindManyPaceGroupMemberships,
    mockFindFirstBatch,
    mockFindFirstPaceGroup,
    mockFindFirstTask,
    mockFindFirstBook,
    mockFindManyOffsets,
    mockTx,
  };
});

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
    },
    transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
      cb(mockTx),
    ),
  },
}));

vi.mock("server-only", () => ({}));

import {
  formatDateKey,
  addCalendarDays,
  calculateTaskEffectiveDate,
  getMemberActiveBatch,
  getMemberActivePaceGroup,
  validateDailyProgressEligibility,
  DailyProgressError,
} from "@/lib/services/daily-progress";

describe("Daily Progress - Date & Cadence Calculations", () => {
  it("formatDateKey handles Date objects and ISO strings", () => {
    expect(formatDateKey(new Date("2026-09-08T12:00:00.000Z"))).toBe(
      "2026-09-08",
    );
    expect(formatDateKey("2026-09-08T08:00:00Z")).toBe("2026-09-08");
    expect(formatDateKey("2026-09-08")).toBe("2026-09-08");
  });

  it("addCalendarDays adds calendar days correctly across month/year boundaries", () => {
    expect(addCalendarDays("2026-01-15", 3)).toBe("2026-01-18");
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2026-01-15", -2)).toBe("2026-01-13");
  });

  it("calculates daily (7 days/week) cadence effective dates", () => {
    const startDate = "2026-01-15";
    expect(calculateTaskEffectiveDate(startDate, 1, 7)).toBe("2026-01-15");
    expect(calculateTaskEffectiveDate(startDate, 2, 7)).toBe("2026-01-16");
    expect(calculateTaskEffectiveDate(startDate, 7, 7)).toBe("2026-01-21");
    expect(calculateTaskEffectiveDate(startDate, 8, 7)).toBe("2026-01-22");
  });

  it("calculates 6-day cadence with rest day per 7-day cycle", () => {
    const startDate = "2026-01-15";
    // Days 1..6 run on calendar offsets 0..5
    expect(calculateTaskEffectiveDate(startDate, 1, 6)).toBe("2026-01-15");
    expect(calculateTaskEffectiveDate(startDate, 6, 6)).toBe("2026-01-20");
    // Day 7 skips 1 rest day (calendar offset 7 = 2026-01-22)
    expect(calculateTaskEffectiveDate(startDate, 7, 6)).toBe("2026-01-22");
    expect(calculateTaskEffectiveDate(startDate, 8, 6)).toBe("2026-01-23");
  });

  it("applies pacing offsets to effective dates correctly", () => {
    const startDate = "2026-01-15";
    const offsets = [
      { effectiveFromDayNumber: 3, offsetDays: 2 }, // +2 days pause at step 3
    ];
    // Day 1 & 2 unaffected
    expect(calculateTaskEffectiveDate(startDate, 1, 6, offsets)).toBe(
      "2026-01-15",
    );
    expect(calculateTaskEffectiveDate(startDate, 2, 6, offsets)).toBe(
      "2026-01-16",
    );
    // Day 3 shifted by +2 days (originally 2026-01-17 -> 2026-01-19)
    expect(calculateTaskEffectiveDate(startDate, 3, 6, offsets)).toBe(
      "2026-01-19",
    );
  });
});

describe("Daily Progress - Active Membership Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves active batch membership successfully", async () => {
    mockFindFirstBatchMembership.mockResolvedValue({
      id: "bm-1",
      profileId: "prof-1",
      batchId: "batch-1",
      status: "active",
    });
    mockFindFirstBatch.mockResolvedValue({
      id: "batch-1",
      name: "Batch Alpha",
      startDate: "2026-01-15",
      readingDaysPerWeek: 6,
    });

    const result = await getMemberActiveBatch("prof-1", mockTx as any);
    expect(result.membership.id).toBe("bm-1");
    expect(result.batch.name).toBe("Batch Alpha");
  });

  it("throws NO_ACTIVE_BATCH when member has no active batch membership", async () => {
    mockFindFirstBatchMembership.mockResolvedValue(undefined);

    await expect(
      getMemberActiveBatch("prof-unregistered", mockTx as any),
    ).rejects.toThrow(DailyProgressError);
    await expect(
      getMemberActiveBatch("prof-unregistered", mockTx as any),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_BATCH",
    });
  });

  it("resolves active pace group in the active batch successfully", async () => {
    mockFindManyPaceGroupMemberships.mockResolvedValue([
      {
        id: "pgm-1",
        profileId: "prof-1",
        paceGroupId: "group-10-pages",
        status: "active",
      },
    ]);
    mockFindFirstPaceGroup.mockResolvedValue({
      id: "group-10-pages",
      batchId: "batch-1",
      name: "10 Pages/Day",
      size: 10,
    });

    const result = await getMemberActivePaceGroup(
      "prof-1",
      "batch-1",
      mockTx as any,
    );
    expect(result.membership.id).toBe("pgm-1");
    expect(result.paceGroup.name).toBe("10 Pages/Day");
  });

  it("throws NO_ACTIVE_PACE_GROUP when member is not assigned to any pace group", async () => {
    mockFindManyPaceGroupMemberships.mockResolvedValue([]);

    await expect(
      getMemberActivePaceGroup("prof-1", "batch-1", mockTx as any),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_PACE_GROUP",
    });
  });

  it("throws NO_ACTIVE_PACE_GROUP when member's pace group belongs to a different batch", async () => {
    mockFindManyPaceGroupMemberships.mockResolvedValue([
      {
        id: "pgm-2",
        profileId: "prof-1",
        paceGroupId: "group-other-batch",
        status: "active",
      },
    ]);
    // Pace group query matching batch-1 returns null because it belongs to batch-2
    mockFindFirstPaceGroup.mockResolvedValue(undefined);

    await expect(
      getMemberActivePaceGroup("prof-1", "batch-1", mockTx as any),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_PACE_GROUP",
    });
  });
});

describe("Daily Progress - validateDailyProgressEligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validProfileId = "550e8400-e29b-41d4-a716-446655440001";
  const validTaskId = "550e8400-e29b-41d4-a716-446655440002";
  const validBookId = "550e8400-e29b-41d4-a716-446655440003";
  const validBatchId = "550e8400-e29b-41d4-a716-446655440004";
  const validPaceGroupId = "550e8400-e29b-41d4-a716-446655440005";

  function setupValidMocks(overrides?: {
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
      name: "Rihletel ilem",
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

  it("successfully validates when all conditions are met", async () => {
    setupValidMocks();

    const result = await validateDailyProgressEligibility(
      validProfileId,
      validTaskId,
      "2026-01-15",
      mockTx as any,
    );

    expect(result.profileId).toBe(validProfileId);
    expect(result.batchId).toBe(validBatchId);
    expect(result.paceGroupId).toBe(validPaceGroupId);
    expect(result.taskId).toBe(validTaskId);
    expect(result.effectiveDate).toBe("2026-01-15");
    expect(result.isPublished).toBe(true);
  });

  it("throws UNAUTHENTICATED when profile ID is missing or empty", async () => {
    await expect(
      validateDailyProgressEligibility("", validTaskId, "2026-01-15", mockTx as any),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws INVALID_INPUT when task ID is missing or empty", async () => {
    await expect(
      validateDailyProgressEligibility(validProfileId, "", "2026-01-15", mockTx as any),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("throws TASK_NOT_FOUND when task does not exist in master curriculum", async () => {
    setupValidMocks();
    mockFindFirstTask.mockResolvedValue(undefined);

    await expect(
      validateDailyProgressEligibility(
        validProfileId,
        validTaskId,
        "2026-01-15",
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("throws BATCH_NOT_STARTED when batch has no configured start date", async () => {
    setupValidMocks({ batchStartDate: null });

    await expect(
      validateDailyProgressEligibility(
        validProfileId,
        validTaskId,
        "2026-01-15",
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "BATCH_NOT_STARTED",
    });
  });

  it("throws BATCH_NOT_STARTED when current date is before batch start date", async () => {
    setupValidMocks({ batchStartDate: "2026-02-01" });

    await expect(
      validateDailyProgressEligibility(
        validProfileId,
        validTaskId,
        "2026-01-15", // Checking before batch starts
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "BATCH_NOT_STARTED",
    });
  });

  it("throws TASK_NOT_PUBLISHED when requested task is scheduled for a future date", async () => {
    // Step 5 on 6-day cadence starting 2026-01-15 is scheduled for 2026-01-19
    setupValidMocks({ batchStartDate: "2026-01-15", taskDayNumber: 5 });

    await expect(
      validateDailyProgressEligibility(
        validProfileId,
        validTaskId,
        "2026-01-16", // Checking on Jan 16 when task is scheduled for Jan 19
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "TASK_NOT_PUBLISHED",
    });
  });

  it("allows completed/past published tasks (effectiveDate <= localDate)", async () => {
    // Step 1 scheduled for 2026-01-15; user is viewing/marking on 2026-01-20
    setupValidMocks({ batchStartDate: "2026-01-15", taskDayNumber: 1 });

    const result = await validateDailyProgressEligibility(
      validProfileId,
      validTaskId,
      "2026-01-20",
      mockTx as any,
    );

    expect(result.isPublished).toBe(true);
    expect(result.effectiveDate).toBe("2026-01-15");
  });

  it("correctly evaluates publication date with schedule pacing offsets", async () => {
    // Step 2 with a +3 day offset pushes effective date from Jan 16 to Jan 19
    setupValidMocks({
      batchStartDate: "2026-01-15",
      taskDayNumber: 2,
      offsets: [{ effectiveFromDayNumber: 1, offsetDays: 3 }],
    });

    // On Jan 17, task is unpublished because of the +3 day offset
    await expect(
      validateDailyProgressEligibility(
        validProfileId,
        validTaskId,
        "2026-01-17",
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "TASK_NOT_PUBLISHED",
    });

    // On Jan 19, task is now published
    const result = await validateDailyProgressEligibility(
      validProfileId,
      validTaskId,
      "2026-01-19",
      mockTx as any,
    );
    expect(result.isPublished).toBe(true);
    expect(result.effectiveDate).toBe("2026-01-19");
  });
});
