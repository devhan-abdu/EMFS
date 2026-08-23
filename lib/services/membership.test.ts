import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindFirst,
  mockInsertValues,
  mockInsert,
  mockUpdateSet,
  mockUpdate,
  mockTx,
} = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockReturnValue({ returning: vi.fn() });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
  const mockUpdateSet = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: vi.fn() }),
  });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
  const mockFindFirst = vi.fn();

  const mockTx = {
    query: {
      batchMemberships: {
        findFirst: mockFindFirst,
      },
    },
    insert: mockInsert,
    update: mockUpdate,
  };

  return {
    mockFindFirst,
    mockInsertValues,
    mockInsert,
    mockUpdateSet,
    mockUpdate,
    mockTx,
  };
});

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        batchMemberships: {
          findFirst: mockFindFirst,
        },
      },
      insert: mockInsert,
      update: mockUpdate,
      transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return await cb(mockTx);
      }),
    },
  };
});

import {
  isValidTransition,
  createBatchMembership,
  transitionBatchMembership,
  moveBatchMembership,
  reenterBatchMembership,
  MembershipError,
} from "./membership";
import type { BatchMembershipStatus } from "@/db/schema/batch-memberships";
import * as membershipService from "./membership";
import { db } from "@/db";

describe("Membership State Machine - isValidTransition", () => {
  describe("Valid transitions", () => {
    it("allows waitlisted -> applied", () => {
      expect(isValidTransition("waitlisted", "applied")).toBe(true);
    });

    it("allows applied -> approved", () => {
      expect(isValidTransition("applied", "approved")).toBe(true);
    });

    it("allows applied -> rejected", () => {
      expect(isValidTransition("applied", "rejected")).toBe(true);
    });

    it("allows approved -> active", () => {
      expect(isValidTransition("approved", "active")).toBe(true);
    });

    it("allows active -> grace", () => {
      expect(isValidTransition("active", "grace")).toBe(true);
    });

    it("allows active -> removed", () => {
      expect(isValidTransition("active", "removed")).toBe(true);
    });

    it("allows grace -> active", () => {
      expect(isValidTransition("grace", "active")).toBe(true);
    });

    it("allows grace -> removed", () => {
      expect(isValidTransition("grace", "removed")).toBe(true);
    });
  });

  describe("Invalid transitions", () => {
    it("rejects removed -> active", () => {
      expect(isValidTransition("removed", "active")).toBe(false);
    });

    it("rejects removed -> grace", () => {
      expect(isValidTransition("removed", "grace")).toBe(false);
    });

    it("rejects removed -> approved", () => {
      expect(isValidTransition("removed", "approved")).toBe(false);
    });

    it("rejects rejected -> active", () => {
      expect(isValidTransition("rejected", "active")).toBe(false);
    });

    it("rejects rejected -> approved", () => {
      expect(isValidTransition("rejected", "approved")).toBe(false);
    });

    it("rejects active -> approved", () => {
      expect(isValidTransition("active", "approved")).toBe(false);
    });

    it("rejects waitlisted -> active", () => {
      expect(isValidTransition("waitlisted", "active")).toBe(false);
    });

    it("rejects unknown/arbitrary status transitions", () => {
      expect(isValidTransition("active", "unknown" as BatchMembershipStatus)).toBe(false);
      expect(isValidTransition("unknown" as BatchMembershipStatus, "active")).toBe(false);
    });
  });
});

describe("Membership Service - Transition Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully transitions when valid", async () => {
    const existingMembership = {
      id: "mem-1",
      profileId: "prof-1",
      batchId: "batch-1",
      status: "active" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    mockFindFirst.mockResolvedValue(existingMembership);

    const updatedMembership = { ...existingMembership, status: "grace" as BatchMembershipStatus };
    const returningMock = vi.fn().mockResolvedValue([updatedMembership]);
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockReturnValue({ returning: returningMock }) });

    const result = await transitionBatchMembership("mem-1", "grace");
    expect(result).toEqual(updatedMembership);
  });

  it("throws MembershipError when transition is illegal (removed -> active)", async () => {
    const existingMembership = {
      id: "mem-1",
      profileId: "prof-1",
      batchId: "batch-1",
      status: "removed" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: new Date(),
      removalReason: null,
      createdAt: new Date(),
    };

    mockFindFirst.mockResolvedValue(existingMembership);

    await expect(transitionBatchMembership("mem-1", "active")).rejects.toThrow(
      MembershipError
    );
    await expect(transitionBatchMembership("mem-1", "active")).rejects.toThrow(
      "Cannot transition membership status from 'removed' to 'active'."
    );
  });

  it("throws MembershipError when membership is not found", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await expect(
      transitionBatchMembership("non-existent", "active")
    ).rejects.toThrow(MembershipError);
  });

  it("rejects arbitrary/invalid target status", async () => {
    await expect(
      transitionBatchMembership("mem-1", "invalid_status" as unknown as BatchMembershipStatus)
    ).rejects.toThrow("Invalid membership target status 'invalid_status'.");
  });
});

describe("Membership Service - Audit Log Integration & Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("11. successful rejection creates exactly one audit row", async () => {
    const existing = {
      id: "mem-app-1",
      profileId: "prof-1",
      batchId: "batch-1",
      status: "applied" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    mockFindFirst.mockResolvedValue(existing);

    const updated = { ...existing, status: "rejected" as BatchMembershipStatus };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockReturnValue({ returning: returningMock }) });
    mockInsertValues.mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });

    await transitionBatchMembership(
      "mem-app-1",
      "rejected",
      "Application did not meet requirements",
      "actor-admin-id"
    );

    // Expect exactly one insert call for audit log
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const auditInsertPayload = mockInsertValues.mock.calls[0][0];
    expect(auditInsertPayload.memberId).toBe("prof-1");
    expect(auditInsertPayload.fromState).toBe("applied");
    expect(auditInsertPayload.toState).toBe("rejected");
    expect(auditInsertPayload.actorId).toBe("actor-admin-id");
    expect(auditInsertPayload.reason).toBe("Application did not meet requirements");
  });

  it("12. successful removal creates exactly one audit row", async () => {
    const existing = {
      id: "mem-active-1",
      profileId: "prof-2",
      batchId: "batch-1",
      status: "active" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    mockFindFirst.mockResolvedValue(existing);

    const updated = { ...existing, status: "removed" as BatchMembershipStatus };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockReturnValue({ returning: returningMock }) });

    await transitionBatchMembership(
      "mem-active-1",
      "removed",
      "Missed 3 consecutive attendance windows",
      "actor-admin-id"
    );

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const auditInsertPayload = mockInsertValues.mock.calls[0][0];
    expect(auditInsertPayload.fromState).toBe("active");
    expect(auditInsertPayload.toState).toBe("removed");
    expect(auditInsertPayload.reason).toBe("Missed 3 consecutive attendance windows");
  });

  it("13. batch move records correct from_batch_id and to_batch_id", async () => {
    const existing = {
      id: "mem-move-1",
      profileId: "prof-3",
      batchId: "batch-A",
      status: "active" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    mockFindFirst.mockResolvedValue(existing);

    const updated = { ...existing, batchId: "batch-B" };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockReturnValue({ returning: returningMock }) });

    await moveBatchMembership("mem-move-1", "batch-B", "actor-admin-id", "Transferred to Batch B");

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const auditInsertPayload = mockInsertValues.mock.calls[0][0];
    expect(auditInsertPayload.memberId).toBe("prof-3");
    expect(auditInsertPayload.fromBatchId).toBe("batch-A");
    expect(auditInsertPayload.toBatchId).toBe("batch-B");
    expect(auditInsertPayload.actorId).toBe("actor-admin-id");
  });

  it("14. re-entry creates a new audit row & 15. uses canonical membership states", async () => {
    const newMembership = {
      id: "mem-reentry-1",
      profileId: "prof-4",
      batchId: "batch-C",
      status: "applied" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([newMembership]) });

    await reenterBatchMembership(
      "prof-4",
      "batch-A",
      "batch-C",
      "applied",
      "actor-admin-id",
      "Re-entered after appeal"
    );

    expect(mockInsert).toHaveBeenCalledTimes(2); // 1 for membership insert, 1 for audit insert
    const auditInsertPayload = mockInsertValues.mock.calls[1][0];
    expect(auditInsertPayload.fromState).toBe("removed");
    expect(auditInsertPayload.toState).toBe("applied");
    expect(auditInsertPayload.fromBatchId).toBe("batch-A");
    expect(auditInsertPayload.toBatchId).toBe("batch-C");
  });

  it("18. audit records are never updated/deleted by application service", () => {
    // Inspect service exports to ensure no update/delete methods exist for audit logs
    expect(membershipService).not.toHaveProperty("updateAuditRecord");
    expect(membershipService).not.toHaveProperty("deleteAuditRecord");
    expect(membershipService).not.toHaveProperty("updateMembershipAuditLog");
    expect(membershipService).not.toHaveProperty("deleteMembershipAuditLog");
  });

  it("19. failed membership transition does not create a false audit record", async () => {
    const existing = {
      id: "mem-failed-1",
      profileId: "prof-5",
      batchId: "batch-1",
      status: "removed" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: new Date(),
      removalReason: null,
      createdAt: new Date(),
    };

    mockFindFirst.mockResolvedValue(existing);

    // Attempt illegal transition removed -> active
    await expect(
      transitionBatchMembership("mem-failed-1", "active", "Try illegal transition", "actor-admin-id")
    ).rejects.toThrow();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("20. if membership update succeeds, audit insertion succeeds atomically inside transaction", async () => {
    const existing = {
      id: "mem-atomic-1",
      profileId: "prof-6",
      batchId: "batch-1",
      status: "active" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    mockFindFirst.mockResolvedValue(existing);

    const updated = { ...existing, status: "grace" as BatchMembershipStatus };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockReturnValue({ returning: returningMock }) });

    await transitionBatchMembership("mem-atomic-1", "grace", "Grant grace period", "actor-admin-id");

    // Verify transaction wrapper was used
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

describe("Membership Service - Same-batch vs Cross-batch Conflict Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects creating an active/applied membership when one already exists for the SAME batch", async () => {
    const existingActive = {
      id: "mem-1",
      profileId: "prof-1",
      batchId: "batch-A",
      status: "applied" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    mockFindFirst.mockResolvedValue(existingActive);

    await expect(
      createBatchMembership("prof-1", "batch-A", "active")
    ).rejects.toThrow(MembershipError);
    await expect(
      createBatchMembership("prof-1", "batch-A", "active")
    ).rejects.toThrow(
      "Member already has an active or pending membership (status: 'applied') in this batch."
    );
  });

  it("allows creating a membership for a DIFFERENT batch even if member is active in another batch", async () => {
    // No existing record found for Member A + Batch B
    mockFindFirst.mockResolvedValue(undefined);

    const newMembership = {
      id: "mem-2",
      profileId: "prof-1",
      batchId: "batch-B",
      status: "applied" as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    const returningMock = vi.fn().mockResolvedValue([newMembership]);
    mockInsertValues.mockReturnValue({ returning: returningMock });

    const result = await createBatchMembership("prof-1", "batch-B", "applied");
    expect(result).toEqual(newMembership);
  });
});
