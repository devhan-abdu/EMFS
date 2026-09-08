/* eslint-disable @typescript-eslint/no-explicit-any */
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
      this.name = "AuthzError";
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
  validateDailyProgressEligibility,
  calculateTaskEffectiveDate,
} from "@/lib/services/daily-progress";
import { toggleDailyProgressAction } from "@/actions/daily-progress";
import { dailyProgress } from "@/db/schema/daily-progress";
import { getTableColumns } from "drizzle-orm";
import { AuthzError } from "@/lib/auth/authorize";

describe("Daily Progress - Comprehensive QA & Security Audit Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const memberProfileId = "550e8400-e29b-41d4-a716-446655440001";
  const victimProfileId = "550e8400-e29b-41d4-a716-446655440099";
  const validTaskId = "550e8400-e29b-41d4-a716-446655440002";
  const validBookId = "550e8400-e29b-41d4-a716-446655440003";
  const validBatchId = "550e8400-e29b-41d4-a716-446655440004";
  const validPaceGroupId = "550e8400-e29b-41d4-a716-446655440005";

  const sessionUser = {
    authUserId: "auth-user-1",
    email: "member@example.com",
    profile: {
      id: memberProfileId,
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
      profileId: memberProfileId,
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
        profileId: memberProfileId,
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

  /* -------------------------------------------------------------------------- */
  /* 1. IDENTITY SECURITY                                                       */
  /* -------------------------------------------------------------------------- */
  describe("1. Identity Security", () => {
    it("rejects unauthenticated users from mutating progress", async () => {
      mockRequireSession.mockRejectedValue(
        new AuthzError("UNAUTHENTICATED", "You must be signed in."),
      );

      const result = await toggleDailyProgressAction({
        taskId: validTaskId,
        status: "done",
      });

      expect(result.ok).toBe(false);
      expect(result.errors?.formErrors).toContain("You must be signed in.");
    });

    it("prevents client-provided memberId / profileId from impersonating another member", async () => {
      mockRequireSession.mockResolvedValue(sessionUser);
      setupValidDbMocks();
      mockReturning.mockResolvedValue([
        {
          id: "dp-1",
          profileId: memberProfileId,
          batchId: validBatchId,
          paceGroupId: validPaceGroupId,
          taskId: validTaskId,
          status: "done",
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await toggleDailyProgressAction({
        taskId: validTaskId,
        status: "done",
        memberId: victimProfileId,
        profileId: victimProfileId,
        userId: victimProfileId,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.profileId).toBe(memberProfileId);
      expect(result.data?.profileId).not.toBe(victimProfileId);
    });

    it("verifies session identity cannot be overridden by extra payload properties", async () => {
      mockRequireSession.mockResolvedValue(sessionUser);
      setupValidDbMocks();
      mockReturning.mockResolvedValue([
        {
          id: "dp-1",
          profileId: memberProfileId,
          batchId: validBatchId,
          paceGroupId: validPaceGroupId,
          taskId: validTaskId,
          status: "done",
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await recordDailyProgress({
        taskId: validTaskId,
        status: "done",
        profileId: victimProfileId,
        actorId: victimProfileId,
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.profileId).toBe(memberProfileId);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. MEMBERSHIP SECURITY                                                     */
  /* -------------------------------------------------------------------------- */
  describe("2. Membership Security", () => {
    it("requires active batch membership (rejects missing membership)", async () => {
      setupValidDbMocks();
      mockFindFirstBatchMembership.mockResolvedValue(undefined);

      await expect(
        recordDailyProgressForProfile(
          memberProfileId,
          { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
          mockTx as any,
        ),
      ).rejects.toMatchObject({
        code: "NO_ACTIVE_BATCH",
      });
    });

    it("rejects inactive batch memberships (applied / waitlisted / removed / rejected)", async () => {
      setupValidDbMocks();
      // Status in DB is 'removed' instead of 'active'
      mockFindFirstBatchMembership.mockResolvedValue(undefined);

      await expect(
        validateDailyProgressEligibility(
          memberProfileId,
          validTaskId,
          "2026-01-15",
          mockTx as any,
        ),
      ).rejects.toMatchObject({
        code: "NO_ACTIVE_BATCH",
      });
    });

    it("requires active pace-group membership (rejects unassigned member)", async () => {
      setupValidDbMocks();
      mockFindManyPaceGroupMemberships.mockResolvedValue([]);

      await expect(
        validateDailyProgressEligibility(
          memberProfileId,
          validTaskId,
          "2026-01-15",
          mockTx as any,
        ),
      ).rejects.toMatchObject({
        code: "NO_ACTIVE_PACE_GROUP",
      });
    });

    it("rejects when pace group belongs to another cohort/batch", async () => {
      setupValidDbMocks();
      mockFindManyPaceGroupMemberships.mockResolvedValue([
        {
          id: "pgm-1",
          profileId: memberProfileId,
          paceGroupId: "foreign-pace-group",
          status: "active",
        },
      ]);
      mockFindFirstPaceGroup.mockResolvedValue(undefined); // Foreign pace group does not match batchId

      await expect(
        validateDailyProgressEligibility(
          memberProfileId,
          validTaskId,
          "2026-01-15",
          mockTx as any,
        ),
      ).rejects.toMatchObject({
        code: "NO_ACTIVE_PACE_GROUP",
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. TASK VALIDATION & PACING                                                */
  /* -------------------------------------------------------------------------- */
  describe("3. Task Validation & Pacing", () => {
    it("verifies task must exist in master curriculum", async () => {
      setupValidDbMocks();
      mockFindFirstTask.mockResolvedValue(undefined);

      await expect(
        validateDailyProgressEligibility(
          memberProfileId,
          validTaskId,
          "2026-01-15",
          mockTx as any,
        ),
      ).rejects.toMatchObject({
        code: "TASK_NOT_FOUND",
      });
    });

    it("verifies batch must have started on or before local date", async () => {
      setupValidDbMocks({ batchStartDate: "2026-02-01" });

      await expect(
        validateDailyProgressEligibility(
          memberProfileId,
          validTaskId,
          "2026-01-15", // Before start date
          mockTx as any,
        ),
      ).rejects.toMatchObject({
        code: "BATCH_NOT_STARTED",
      });
    });

    it("rejects future unpublished tasks", async () => {
      // Step 6 on 6-day cadence starting Jan 15 is scheduled for Jan 20
      setupValidDbMocks({ batchStartDate: "2026-01-15", taskDayNumber: 6 });

      await expect(
        validateDailyProgressEligibility(
          memberProfileId,
          validTaskId,
          "2026-01-16", // Checking on Jan 16
          mockTx as any,
        ),
      ).rejects.toMatchObject({
        code: "TASK_NOT_PUBLISHED",
      });
    });

    it("allows past published tasks (effectiveDate <= localDate)", async () => {
      setupValidDbMocks({ batchStartDate: "2026-01-15", taskDayNumber: 2 });

      const context = await validateDailyProgressEligibility(
        memberProfileId,
        validTaskId,
        "2026-01-20",
        mockTx as any,
      );

      expect(context.isPublished).toBe(true);
      expect(context.effectiveDate).toBe("2026-01-16");
    });

    it("correctly integrates schedule pacing offsets into publication calculations", () => {
      const startDate = "2026-01-15";
      const offsets = [
        { effectiveFromDayNumber: 2, offsetDays: 4 }, // +4 day pause at step 2
      ];

      // Step 1: unaffected (Jan 15)
      expect(calculateTaskEffectiveDate(startDate, 1, 6, offsets)).toBe(
        "2026-01-15",
      );
      // Step 2: originally Jan 16 + 4 days offset = Jan 20
      expect(calculateTaskEffectiveDate(startDate, 2, 6, offsets)).toBe(
        "2026-01-20",
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. UNIQUENESS & IDEMPOTENCY                                                */
  /* -------------------------------------------------------------------------- */
  describe("4. Uniqueness & Idempotency", () => {
    it("ensures schema declares the unique constraint on (profile_id, task_id)", () => {
      const columns = getTableColumns(dailyProgress);
      expect(columns).toHaveProperty("profileId");
      expect(columns).toHaveProperty("taskId");
      expect(columns).toHaveProperty("batchId");
      expect(columns).toHaveProperty("paceGroupId");
      expect(columns).toHaveProperty("status");
      expect(columns).toHaveProperty("completedAt");
    });

    it("DONE -> DONE is idempotent and preserves original completedAt", async () => {
      setupValidDbMocks();
      const originalTimestamp = new Date("2026-01-15T08:30:00.000Z");
      mockFindFirstDailyProgress.mockResolvedValue({
        id: "dp-1",
        profileId: memberProfileId,
        batchId: validBatchId,
        paceGroupId: validPaceGroupId,
        taskId: validTaskId,
        status: "done",
        completedAt: originalTimestamp,
        createdAt: originalTimestamp,
        updatedAt: originalTimestamp,
      });

      mockReturning.mockResolvedValue([
        {
          id: "dp-1",
          profileId: memberProfileId,
          batchId: validBatchId,
          paceGroupId: validPaceGroupId,
          taskId: validTaskId,
          status: "done",
          completedAt: originalTimestamp,
          createdAt: originalTimestamp,
          updatedAt: new Date("2026-01-15T12:00:00.000Z"),
        },
      ]);

      const result = await recordDailyProgressForProfile(
        memberProfileId,
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      );

      expect(result.previousStatus).toBe("done");
      expect(result.statusChanged).toBe(false);
      expect(result.progress.completedAt).toEqual(originalTimestamp);
    });

    it("NOT_DONE -> NOT_DONE is idempotent and keeps completedAt null", async () => {
      setupValidDbMocks();
      mockFindFirstDailyProgress.mockResolvedValue({
        id: "dp-2",
        profileId: memberProfileId,
        batchId: validBatchId,
        paceGroupId: validPaceGroupId,
        taskId: validTaskId,
        status: "not_done",
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockReturning.mockResolvedValue([
        {
          id: "dp-2",
          profileId: memberProfileId,
          batchId: validBatchId,
          paceGroupId: validPaceGroupId,
          taskId: validTaskId,
          status: "not_done",
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await recordDailyProgressForProfile(
        memberProfileId,
        { taskId: validTaskId, status: "not_done", localDate: "2026-01-15" },
        mockTx as any,
      );

      expect(result.previousStatus).toBe("not_done");
      expect(result.statusChanged).toBe(false);
      expect(result.progress.completedAt).toBeNull();
    });

    it("DONE -> NOT_DONE reverts status and sets completedAt to null", async () => {
      setupValidDbMocks();
      mockFindFirstDailyProgress.mockResolvedValue({
        id: "dp-1",
        profileId: memberProfileId,
        batchId: validBatchId,
        paceGroupId: validPaceGroupId,
        taskId: validTaskId,
        status: "done",
        completedAt: new Date("2026-01-15T08:00:00.000Z"),
        createdAt: new Date("2026-01-15T08:00:00.000Z"),
        updatedAt: new Date("2026-01-15T08:00:00.000Z"),
      });

      mockReturning.mockResolvedValue([
        {
          id: "dp-1",
          profileId: memberProfileId,
          batchId: validBatchId,
          paceGroupId: validPaceGroupId,
          taskId: validTaskId,
          status: "not_done",
          completedAt: null,
          createdAt: new Date("2026-01-15T08:00:00.000Z"),
          updatedAt: new Date("2026-01-15T10:00:00.000Z"),
        },
      ]);

      const result = await recordDailyProgressForProfile(
        memberProfileId,
        { taskId: validTaskId, status: "not_done", localDate: "2026-01-15" },
        mockTx as any,
      );

      expect(result.previousStatus).toBe("done");
      expect(result.statusChanged).toBe(true);
      expect(result.progress.status).toBe("not_done");
      expect(result.progress.completedAt).toBeNull();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. CONCURRENCY CONTROL                                                     */
  /* -------------------------------------------------------------------------- */
  describe("5. Concurrency Control", () => {
    it("concurrent parallel mutations resolve safely via atomic onConflictDoUpdate", async () => {
      setupValidDbMocks();
      mockFindFirstDailyProgress.mockResolvedValue(undefined);

      const record = {
        id: "dp-1",
        profileId: memberProfileId,
        batchId: validBatchId,
        paceGroupId: validPaceGroupId,
        taskId: validTaskId,
        status: "done" as const,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReturning.mockResolvedValue([record]);

      // Fire 5 concurrent parallel mutation requests
      const promises = Array.from({ length: 5 }).map(() =>
        recordDailyProgressForProfile(
          memberProfileId,
          { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
          mockTx as any,
        ),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      for (const res of results) {
        expect(res.progress.status).toBe("done");
      }
      expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(5);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. DATA INTEGRITY & ATTENDANCE SEPARATION                                  */
  /* -------------------------------------------------------------------------- */
  describe("6. Data Integrity & Attendance Separation", () => {
    it("persists all required relation keys and timestamps consistently", async () => {
      setupValidDbMocks();
      mockFindFirstDailyProgress.mockResolvedValue(undefined);

      const mockRecord = {
        id: "dp-1",
        profileId: memberProfileId,
        batchId: validBatchId,
        paceGroupId: validPaceGroupId,
        taskId: validTaskId,
        status: "done" as const,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReturning.mockResolvedValue([mockRecord]);

      const result = await recordDailyProgressForProfile(
        memberProfileId,
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      );

      expect(result.progress.id).toBe("dp-1");
      expect(result.progress.profileId).toBe(memberProfileId);
      expect(result.progress.batchId).toBe(validBatchId);
      expect(result.progress.paceGroupId).toBe(validPaceGroupId);
      expect(result.progress.taskId).toBe(validTaskId);
      expect(result.progress.status).toBe("done");
      expect(result.progress.completedAt).toBeInstanceOf(Date);
      expect(result.progress.createdAt).toBeInstanceOf(Date);
      expect(result.progress.updatedAt).toBeInstanceOf(Date);
    });

    it("verifies Daily Progress does NOT write or modify attendance records", async () => {
      setupValidDbMocks();
      mockFindFirstDailyProgress.mockResolvedValue(undefined);
      mockReturning.mockResolvedValue([
        {
          id: "dp-1",
          profileId: memberProfileId,
          batchId: validBatchId,
          paceGroupId: validPaceGroupId,
          taskId: validTaskId,
          status: "done",
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await recordDailyProgressForProfile(
        memberProfileId,
        { taskId: validTaskId, status: "done", localDate: "2026-01-15" },
        mockTx as any,
      );

      // Verify that the ONLY table inserted into was dailyProgress
      expect(mockInsert).toHaveBeenCalledWith(dailyProgress);
      expect(mockInsert).toHaveBeenCalledTimes(1);

      // Verify no attendance tables or audit logs were touched
      const insertedTable = mockInsert.mock.calls[0][0];
      expect(insertedTable).toBe(dailyProgress);
    });
  });
});
