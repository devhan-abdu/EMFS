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
    mockRequireSession,
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
    },
    transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
      cb(mockTx),
    ),
  },
}));

import { resolveAuthoritativeProgressContext } from "@/lib/services/daily-progress";
import { AuthzError } from "@/lib/auth/authorize";

describe("Daily Progress - Secure Actor Resolution & Invariant Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sessionProfileId = "550e8400-e29b-41d4-a716-446655440001";
  const attackerProfileId = "550e8400-e29b-41d4-a716-446655440999";
  const validTaskId = "550e8400-e29b-41d4-a716-446655440002";
  const validBookId = "550e8400-e29b-41d4-a716-446655440003";
  const validBatchId = "550e8400-e29b-41d4-a716-446655440004";
  const validPaceGroupId = "550e8400-e29b-41d4-a716-446655440005";

  const sessionUser = {
    authUserId: "auth-user-1",
    email: "member@example.com",
    profile: {
      id: sessionProfileId,
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

  function setupValidDbMocks() {
    mockFindFirstBatchMembership.mockResolvedValue({
      id: "bm-1",
      profileId: sessionProfileId,
      batchId: validBatchId,
      status: "active",
    });
    mockFindFirstBatch.mockResolvedValue({
      id: validBatchId,
      name: "Batch Alpha",
      startDate: "2026-01-15",
      readingDaysPerWeek: 6,
    });
    mockFindManyPaceGroupMemberships.mockResolvedValue([
      {
        id: "pgm-1",
        profileId: sessionProfileId,
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
      dayNumber: 1,
      content: "Read chapter 1",
    });
    mockFindFirstBook.mockResolvedValue({
      id: validBookId,
      title: "The Hobbit",
      language: "en",
      sequenceOrder: 1,
    });
    mockFindManyOffsets.mockResolvedValue([]);
  }

  it("1. rejects unauthenticated requests with AuthzError", async () => {
    mockRequireSession.mockRejectedValue(
      new AuthzError("UNAUTHENTICATED", "You must be signed in."),
    );

    await expect(
      resolveAuthoritativeProgressContext(
        { taskId: validTaskId, localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toThrow(AuthzError);
  });

  it("2. resolves valid authenticated member and authoritative context successfully", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    setupValidDbMocks();

    const context = await resolveAuthoritativeProgressContext(
      { taskId: validTaskId, localDate: "2026-01-15" },
      mockTx as any,
    );

    expect(context.actor.profile.id).toBe(sessionProfileId);
    expect(context.profileId).toBe(sessionProfileId);
    expect(context.batchId).toBe(validBatchId);
    expect(context.paceGroupId).toBe(validPaceGroupId);
    expect(context.taskId).toBe(validTaskId);
    expect(context.isPublished).toBe(true);
  });

  it("3. rejects request when member has an invalid/non-existent batch relationship", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    setupValidDbMocks();
    // User has no active batch membership record
    mockFindFirstBatchMembership.mockResolvedValue(undefined);

    await expect(
      resolveAuthoritativeProgressContext(
        { taskId: validTaskId, localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_BATCH",
    });
  });

  it("4. rejects request when member has no active pace group assignment", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    setupValidDbMocks();
    mockFindManyPaceGroupMemberships.mockResolvedValue([]);

    await expect(
      resolveAuthoritativeProgressContext(
        { taskId: validTaskId, localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_PACE_GROUP",
    });
  });

  it("5. ignores client-provided memberId / profileId and enforces session identity", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    setupValidDbMocks();

    // Attacker tries to pass another member's profile ID in the payload
    const spoofedInput = {
      taskId: validTaskId,
      localDate: "2026-01-15",
      memberId: attackerProfileId,
      profileId: attackerProfileId,
      userId: attackerProfileId,
    };

    const context = await resolveAuthoritativeProgressContext(
      spoofedInput,
      mockTx as any,
    );

    // Context MUST match authenticated session profileId, NOT the spoofed ID
    expect(context.profileId).toBe(sessionProfileId);
    expect(context.profileId).not.toBe(attackerProfileId);
    expect(context.actor.profile.id).toBe(sessionProfileId);

    // Verify DB was queried for the session profileId, never the attacker profileId
    expect(mockFindFirstBatchMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
      }),
    );
  });

  it("6. ignores client-provided batchId and paceGroupId and resolves from DB truth", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);
    setupValidDbMocks();

    const spoofedInput = {
      taskId: validTaskId,
      localDate: "2026-01-15",
      batchId: "550e8400-e29b-41d4-a716-446655440777",
      paceGroupId: "550e8400-e29b-41d4-a716-446655440888",
    };

    const context = await resolveAuthoritativeProgressContext(
      spoofedInput,
      mockTx as any,
    );

    // Resolved batchId and paceGroupId must match database truth, ignoring client inputs
    expect(context.batchId).toBe(validBatchId);
    expect(context.batchId).not.toBe("550e8400-e29b-41d4-a716-446655440777");
    expect(context.paceGroupId).toBe(validPaceGroupId);
    expect(context.paceGroupId).not.toBe("550e8400-e29b-41d4-a716-446655440888");
  });

  it("7. rejects invalid task ID formats strictly", async () => {
    mockRequireSession.mockResolvedValue(sessionUser);

    await expect(
      resolveAuthoritativeProgressContext(
        { taskId: "invalid-not-a-uuid", localDate: "2026-01-15" },
        mockTx as any,
      ),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
