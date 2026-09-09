import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveCurrentBookAction,
  getTodayTaskProposalAction,
  publishPaceGroupTaskAction,
} from "@/actions/pacing";

const { mockRequireRole, AuthzErrorMock } = vi.hoisted(() => {
  class AuthzErrorMock extends Error {
    code: "UNAUTHENTICATED" | "FORBIDDEN";
    constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
      super(message);
      this.code = code;
    }
  }

  const mockRequireRole = vi.fn();
  return { mockRequireRole, AuthzErrorMock };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/authorize", () => ({
  AuthzError: AuthzErrorMock,
  requireRole: mockRequireRole,
  authzErrorToFieldError: vi.fn((error: InstanceType<typeof AuthzErrorMock>) => ({
    field: "auth",
    message: error.message,
    code: error.code,
  })),
}));

const mockServices = vi.hoisted(() => {
  const resolveCurrentBookForBatchMock = vi.fn();
  const getTodayTaskProposalMock = vi.fn();
  const publishPaceGroupTaskMock = vi.fn();

  return {
    resolveCurrentBookForBatchMock,
    getTodayTaskProposalMock,
    publishPaceGroupTaskMock,
  };
});

vi.mock("@/lib/services/pacing", () => ({
  PacingError: class extends Error {
    code = "TEST_ERROR";
  },
  resolveCurrentBookForBatch: mockServices.resolveCurrentBookForBatchMock,
  getTodayTaskProposal: mockServices.getTodayTaskProposalMock,
  publishPaceGroupTask: mockServices.publishPaceGroupTaskMock,
}));

describe("Pacing Server Actions Authorization & Execution", () => {
  const batchId = "550e8400-e29b-41d4-a716-446655440001";
  const paceGroupId = "660e8400-e29b-41d4-a716-446655440001";
  const bookId = "770e8400-e29b-41d4-a716-446655440001";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("denies unauthenticated or unauthorized member roles", async () => {
    mockRequireRole.mockRejectedValueOnce(
      new AuthzErrorMock("FORBIDDEN", "Role 'member' is not permitted.")
    );

    const result = await resolveCurrentBookAction({ batchId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain("Role 'member' is not permitted.");
    }
  });

  it("allows pace_admin to resolve current book", async () => {
    mockRequireRole.mockResolvedValueOnce({
      user: { id: "user-1" },
      profile: { id: "profile-1", role: "pace_admin" },
    });
    mockServices.resolveCurrentBookForBatchMock.mockResolvedValueOnce({
      batchId,
      dayNumber: 1,
      isStarted: true,
      currentBook: { id: bookId, title: "Atomic Habits" },
      nextBook: null,
    });

    const result = await resolveCurrentBookAction({ batchId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dayNumber).toBe(1);
      expect(result.data.currentBook?.title).toBe("Atomic Habits");
    }
  });

  it("allows pace_admin to lookup today's task proposal", async () => {
    mockRequireRole.mockResolvedValueOnce({
      user: { id: "user-1" },
      profile: { id: "profile-1", role: "pace_admin" },
    });
    mockServices.getTodayTaskProposalMock.mockResolvedValueOnce({
      batchId,
      paceGroupId,
      pace: 10,
      cursor: 8,
      proposedPageRange: { startPage: 9, endPage: 18 },
      source: "draft",
    });

    const result = await getTodayTaskProposalAction({ batchId, paceGroupId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposedPageRange).toEqual({ startPage: 9, endPage: 18 });
    }
  });

  it("allows pace_admin to publish adjusted task", async () => {
    mockRequireRole.mockResolvedValueOnce({
      user: { id: "user-1" },
      profile: { id: "profile-1", role: "pace_admin" },
    });
    mockServices.publishPaceGroupTaskMock.mockResolvedValueOnce({
      previousCursor: 8,
      newCursor: 15,
      publishedRange: { startPage: 9, endPage: 15 },
    });

    const result = await publishPaceGroupTaskAction({
      batchId,
      paceGroupId,
      bookId,
      startPage: 9,
      endPage: 15,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.newCursor).toBe(15);
    }
    expect(mockRequireRole).toHaveBeenCalledWith([
      "pace_admin",
      "batch_admin",
      "super_admin",
    ]);
  });

  it("allows batch_admin and super_admin as well", async () => {
    mockRequireRole.mockResolvedValueOnce({
      user: { id: "user-super" },
      profile: { id: "profile-super", role: "super_admin" },
    });
    mockServices.resolveCurrentBookForBatchMock.mockResolvedValueOnce({
      batchId,
      dayNumber: 2,
      isStarted: true,
      currentBook: { id: bookId, title: "Atomic Habits" },
      nextBook: null,
    });

    const result = await resolveCurrentBookAction({ batchId });
    expect(result.ok).toBe(true);
  });
});
