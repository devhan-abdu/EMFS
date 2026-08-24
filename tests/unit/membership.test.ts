import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isValidTransition,
  createBatchMembership,
  transitionBatchMembership,
  MembershipError,
} from "@/lib/services/membership";
import type { BatchMembershipStatus } from "@/db/schema/batch-memberships";

// Mock the db module
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        batchMemberships: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn(),
      update: vi.fn(),
    },
  };
});

import { db } from "@/db";

describe("Membership State Machine - isValidTransition", () => {
  describe("Valid transitions", () => {
    it("allows waitlisted -> applied", () => {
      expect(isValidTransition("waitlisted", "applied")).toBe(true);
    });

    it("allows waitlisted -> removed", () => {
      expect(isValidTransition("waitlisted", "removed")).toBe(true);
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
    vi.resetAllMocks();
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

    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(
      existingMembership
    );

    const updatedMembership = { ...existingMembership, status: "grace" as BatchMembershipStatus };
    const returningMock = vi.fn().mockResolvedValue([updatedMembership]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    
    vi.mocked(db.update).mockReturnValue({ set: setMock } as unknown as ReturnType<typeof db.update>);

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

    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(
      existingMembership
    );

    await expect(transitionBatchMembership("mem-1", "active")).rejects.toThrow(
      MembershipError
    );
    await expect(transitionBatchMembership("mem-1", "active")).rejects.toThrow(
      "Cannot transition membership status from 'removed' to 'active'."
    );
  });

  it("throws MembershipError when membership is not found", async () => {
    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(undefined);

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

describe("Membership Service - Same-batch vs Cross-batch Conflict Rules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(
      existingActive
    );

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
    vi.mocked(db.query.batchMemberships.findFirst).mockResolvedValue(undefined);

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
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });

    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof db.insert>);

    const result = await createBatchMembership("prof-1", "batch-B", "applied");
    expect(result).toEqual(newMembership);
  });
});
