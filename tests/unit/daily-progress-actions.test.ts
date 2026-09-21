import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRequireSession,
  mockRecordDailyProgressForProfile,
  mockGetDailyProgressForProfile,
} = vi.hoisted(() => {
  const mockRequireSession = vi.fn();
  const mockRecordDailyProgressForProfile = vi.fn();
  const mockGetDailyProgressForProfile = vi.fn();

  return {
    mockRequireSession,
    mockRecordDailyProgressForProfile,
    mockGetDailyProgressForProfile,
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

vi.mock("@/lib/services/daily-progress", () => ({
  recordDailyProgressForProfile: mockRecordDailyProgressForProfile,
  getDailyProgressForProfile: mockGetDailyProgressForProfile,
  DailyProgressError: class DailyProgressError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "DailyProgressError";
    }
  },
}));

import {
  toggleDailyProgressAction,
  getDailyProgressAction,
} from "@/actions/daily-progress";
import { AuthzError } from "@/lib/auth/authorize";
import { DailyProgressError } from "@/lib/services/daily-progress";

describe("Daily Progress Server Actions - Security & Mutation Boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validProfileId = "550e8400-e29b-41d4-a716-446655440001";
  const validTaskId = "550e8400-e29b-41d4-a716-446655440002";
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

  it("1. rejects unauthenticated requests with a safe error structure", async () => {
    mockRequireSession.mockRejectedValue(
      new AuthzError("UNAUTHENTICATED", "You must be signed in."),
    );

    const result = await toggleDailyProgressAction({
      taskId: validTaskId,
      status: "done",
    });

    expect(result.ok).toBe(false);
    expect(result.errors?.formErrors).toContain("You must be signed in.");
    expect(mockRecordDailyProgressForProfile).not.toHaveBeenCalled();
  });

  it("2. rejects invalid input (missing task ID and invalid UUID format)", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);

    const result = await toggleDailyProgressAction({
      taskId: "not-a-uuid",
      status: "invalid-status",
    });

    expect(result.ok).toBe(false);
    expect(result.errors?.fieldErrors).toBeDefined();
    expect(mockRecordDailyProgressForProfile).not.toHaveBeenCalled();
  });

  it("3. prevents identity manipulation: client-provided memberId/batchId are stripped and ignored", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    const mockRecord = {
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
    mockRecordDailyProgressForProfile.mockResolvedValue({
      progress: mockRecord,
      previousStatus: null,
      statusChanged: true,
    });

    // Attacker sends spoofed parameters
    const spoofedInput = {
      taskId: validTaskId,
      status: "done",
      memberId: "attacker-target-id",
      profileId: "attacker-target-id",
      userId: "attacker-target-id",
      batchId: "attacker-batch-id",
      paceGroupId: "attacker-pace-group-id",
    };

    const result = await toggleDailyProgressAction(spoofedInput);

    expect(result.ok).toBe(true);
    expect(result.data?.profileId).toBe(validProfileId);

    // Verify service was called with authenticated profileId, NOT the spoofed memberId
    expect(mockRecordDailyProgressForProfile).toHaveBeenCalledWith(
      validProfileId,
      {
        taskId: validTaskId,
        status: "done",
        localDate: undefined,
      },
    );
  });

  it("4. supports dailyTaskId alias in client payload", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    const mockRecord = {
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
    mockRecordDailyProgressForProfile.mockResolvedValue({
      progress: mockRecord,
      previousStatus: null,
      statusChanged: true,
    });

    const result = await toggleDailyProgressAction({
      dailyTaskId: validTaskId,
      status: "done",
    });

    expect(result.ok).toBe(true);
    expect(mockRecordDailyProgressForProfile).toHaveBeenCalledWith(
      validProfileId,
      {
        taskId: validTaskId,
        status: "done",
        localDate: undefined,
      },
    );
  });

  it("5. successfully executes valid mutation and returns structured data", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    const mockRecord = {
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
    mockRecordDailyProgressForProfile.mockResolvedValue({
      progress: mockRecord,
      previousStatus: null,
      statusChanged: true,
    });

    const result = await toggleDailyProgressAction({
      taskId: validTaskId,
      status: "done",
      localDate: "2026-01-15",
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(mockRecord);
    expect(result.previousStatus).toBeNull();
    expect(result.statusChanged).toBe(true);
  });

  it("6. safely catches domain validation failures (e.g. TASK_NOT_PUBLISHED, NO_ACTIVE_BATCH)", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    mockRecordDailyProgressForProfile.mockRejectedValue(
      new DailyProgressError(
        "TASK_NOT_PUBLISHED",
        "Task for day 5 is scheduled for 2026-01-20, which is unpublished for current date 2026-01-15.",
      ),
    );

    const result = await toggleDailyProgressAction({
      taskId: validTaskId,
      status: "done",
      localDate: "2026-01-15",
    });

    expect(result.ok).toBe(false);
    expect(result.errors?.formErrors[0]).toContain("unpublished");
  });

  it("7. sanitizes raw unexpected database/internal errors without leaking details", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    mockRecordDailyProgressForProfile.mockRejectedValue(
      new Error("FATAL: database connection lost at postgres://internal:5432"),
    );

    const result = await toggleDailyProgressAction({
      taskId: validTaskId,
      status: "done",
    });

    expect(result.ok).toBe(false);
    expect(result.errors?.formErrors[0]).toBe(
      "An unexpected error occurred while saving your reading progress.",
    );
    expect(result.errors?.formErrors[0]).not.toContain("postgres://");
  });

  it("8. getDailyProgressAction returns progress record for authenticated member", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    const mockRecord = {
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
    mockGetDailyProgressForProfile.mockResolvedValue(mockRecord);

    const result = await getDailyProgressAction({
      taskId: validTaskId,
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(mockRecord);
    expect(mockGetDailyProgressForProfile).toHaveBeenCalledWith(
      validProfileId,
      validTaskId,
    );
  });
});
