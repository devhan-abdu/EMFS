import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBatchAction } from "@/actions/batch";
import * as authorizeModule from "@/lib/auth/authorize";
import * as batchService from "@/lib/services/batch";

vi.mock("@/lib/auth/authorize", () => ({
  requireRole: vi.fn(),
  AuthzError: class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "AuthzError";
    }
  },
}));

vi.mock("@/lib/services/batch", () => ({
  createBatch: vi.fn(),
  BatchError: class BatchError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "BatchError";
    }
  },
}));

describe("Batch Server Actions - Authorization & Execution", () => {
  const superAdminProfileId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permits Super Admin to create a batch", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: superAdminProfileId,
        authUserId: "auth-super-1",
        role: "super_admin",
        firstName: "Super",
        fatherName: "Admin",
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const mockBatchRecord = {
      id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      name: "New Batch 2026",
      maxMembers: 50,
      paceGroupCount: 1,
      registrationOpen: false,
      autoApprove: true,
      startDate: "2026-09-01",
      readingDaysPerWeek: 7,
      createdBy: superAdminProfileId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(batchService.createBatch).mockResolvedValue({
      batch: mockBatchRecord,
      assignedAdminIds: [superAdminProfileId],
    });

    const payload = {
      name: "New Batch 2026",
      maxMembers: 50,
      paceGroupCount: 1,
      startDate: "2026-09-01",
      pacingType: "daily",
    };

    const res = await createBatchAction(payload);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.batch.name).toBe("New Batch 2026");
      expect(res.data.batch.registrationOpen).toBe(false);
    }
    expect(authorizeModule.requireRole).toHaveBeenCalledWith(["super_admin"]);
    expect(batchService.createBatch).toHaveBeenCalledWith(
      superAdminProfileId,
      expect.objectContaining({
        name: "New Batch 2026",
        maxMembers: 50,
        paceGroupCount: 1,
        pacingType: "daily",
      })
    );
  });

  it("rejects unauthorized access when user is not a super_admin", async () => {
    vi.mocked(authorizeModule.requireRole).mockRejectedValue(
      new authorizeModule.AuthzError(
        "FORBIDDEN",
        "Role 'batch_admin' is not permitted. Required at least: super_admin."
      )
    );

    await expect(
      createBatchAction({
        name: "Forbidden Batch",
        maxMembers: 50,
        paceGroupCount: 1,
        startDate: "2026-09-01",
        pacingType: "daily",
      })
    ).rejects.toThrow("Role 'batch_admin' is not permitted");

    expect(batchService.createBatch).not.toHaveBeenCalled();
  });

  it("returns validation error object on invalid input", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: superAdminProfileId,
        authUserId: "auth-super-1",
        role: "super_admin",
        firstName: "Super",
        fatherName: "Admin",
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const invalidPayload = {
      name: "", // Empty name
      maxMembers: -5, // Negative max members
      paceGroupCount: 0, // < 1
      startDate: "invalid",
      pacingType: "not-a-pacing-type",
    };

    const res = await createBatchAction(invalidPayload);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.fieldErrors).toHaveProperty("name");
      expect(res.errors.fieldErrors).toHaveProperty("maxMembers");
      expect(res.errors.fieldErrors).toHaveProperty("paceGroupCount");
      expect(res.errors.fieldErrors).toHaveProperty("startDate");
      expect(res.errors.fieldErrors).toHaveProperty("pacingType");
    }
    expect(batchService.createBatch).not.toHaveBeenCalled();
  });

  it("handles BatchError gracefully and returns formatted form error", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: superAdminProfileId,
        authUserId: "auth-super-1",
        role: "super_admin",
        firstName: "Super",
        fatherName: "Admin",
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    vi.mocked(batchService.createBatch).mockRejectedValue(
      new batchService.BatchError(
        "ADMIN_NOT_FOUND",
        "Admin profile(s) not found: 11111111-1111-4111-8111-111111111111"
      )
    );

    const payload = {
      name: "Valid Name",
      maxMembers: 50,
      paceGroupCount: 1,
      startDate: "2026-09-01",
      pacingType: "daily",
      adminIds: ["11111111-1111-4111-8111-111111111111"],
    };

    const res = await createBatchAction(payload);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.formErrors).toContain(
        "Admin profile(s) not found: 11111111-1111-4111-8111-111111111111"
      );
    }
  });
});
