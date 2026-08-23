import { describe, it, expect } from "vitest";
import {
  HISTORICAL_STATUS_MAPPINGS,
  validateCanonicalMembershipRow,
  normalizeMembershipLifecycleRow,
  type MembershipDataRow,
} from "./migration";
import {
  BATCH_MEMBERSHIP_STATUSES,
  type BatchMembershipStatus,
} from "@/db/schema/batch-memberships";

describe("Membership Migration & Backfill - Canonical Status & Lifecycle Integrity", () => {
  it("verifies all seven canonical states exist in BATCH_MEMBERSHIP_STATUSES", () => {
    const expected = [
      "waitlisted",
      "applied",
      "approved",
      "rejected",
      "active",
      "grace",
      "removed",
    ];
    expect(BATCH_MEMBERSHIP_STATUSES).toEqual(expected);
  });

  it("documents historical status mappings with clear explanations", () => {
    for (const [key, mapping] of Object.entries(HISTORICAL_STATUS_MAPPINGS)) {
      expect(mapping.historicalStatus).toBe(key);
      expect(BATCH_MEMBERSHIP_STATUSES).toContain(mapping.canonicalStatus);
      expect(mapping.explanation.length).toBeGreaterThan(15);
    }
  });

  it("validates canonical rows and preserves all IDs and foreign keys", () => {
    const validRow: MembershipDataRow = {
      id: "mem-uuid-1",
      profileId: "prof-uuid-1",
      batchId: "batch-uuid-1",
      status: "active",
      startDate: new Date("2026-01-01"),
      endDate: null,
      removalReason: null,
      createdAt: new Date("2026-01-01"),
    };

    expect(validateCanonicalMembershipRow(validRow)).toBe(true);
  });

  it("rejects rows with invalid or non-canonical statuses", () => {
    const invalidRow = {
      id: "mem-uuid-2",
      profileId: "prof-uuid-2",
      batchId: "batch-uuid-2",
      status: "non_existent_status" as unknown as BatchMembershipStatus,
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    expect(() => validateCanonicalMembershipRow(invalidRow)).toThrow(
      /Invalid canonical membership status/
    );
  });

  it("normalizes terminal rows ('removed', 'rejected') to have an endDate without altering IDs or FKs", () => {
    const terminalRowWithoutEndDate: MembershipDataRow = {
      id: "mem-uuid-3",
      profileId: "prof-uuid-3",
      batchId: "batch-uuid-3",
      status: "removed",
      startDate: new Date("2026-01-01"),
      endDate: null,
      removalReason: "Attendance violation",
      createdAt: new Date("2026-01-01"),
    };

    const normalized = normalizeMembershipLifecycleRow(terminalRowWithoutEndDate);
    expect(normalized.id).toBe(terminalRowWithoutEndDate.id);
    expect(normalized.profileId).toBe(terminalRowWithoutEndDate.profileId);
    expect(normalized.batchId).toBe(terminalRowWithoutEndDate.batchId);
    expect(normalized.endDate).toEqual(terminalRowWithoutEndDate.createdAt);
  });

  it("preserves active and pending rows with null endDate intact", () => {
    const nonTerminalRows: MembershipDataRow[] = [
      {
        id: "mem-active",
        profileId: "prof-1",
        batchId: "batch-1",
        status: "active",
        startDate: new Date("2026-01-01"),
        endDate: null,
        removalReason: null,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "mem-applied",
        profileId: "prof-2",
        batchId: "batch-1",
        status: "applied",
        startDate: new Date("2026-01-01"),
        endDate: null,
        removalReason: null,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "mem-waitlisted",
        profileId: "prof-3",
        batchId: "batch-1",
        status: "waitlisted",
        startDate: new Date("2026-01-01"),
        endDate: null,
        removalReason: null,
        createdAt: new Date("2026-01-01"),
      },
    ];

    for (const row of nonTerminalRows) {
      const normalized = normalizeMembershipLifecycleRow(row);
      expect(normalized).toEqual(row);
      expect(normalized.endDate).toBeNull();
    }
  });
});

describe("Membership Migration & Backfill - Reversible Rollback Verification", () => {
  it("captures original NULL end_date in backup table, applies forward normalization, and restores original NULL end_date on rollback", () => {
    const dataset: MembershipDataRow[] = [
      {
        id: "row-removed-null-end",
        profileId: "prof-1",
        batchId: "batch-1",
        status: "removed",
        startDate: new Date("2026-01-01"),
        endDate: null,
        removalReason: "Left cohort",
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
      {
        id: "row-rejected-null-end",
        profileId: "prof-2",
        batchId: "batch-1",
        status: "rejected",
        startDate: new Date("2026-01-01"),
        endDate: null,
        removalReason: "Capacity exceeded",
        createdAt: new Date("2026-01-01T11:00:00Z"),
      },
      {
        id: "row-removed-existing-end",
        profileId: "prof-3",
        batchId: "batch-1",
        status: "removed",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01T12:00:00Z"),
        removalReason: "Opt out",
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
      {
        id: "row-active-null-end",
        profileId: "prof-4",
        batchId: "batch-1",
        status: "active",
        startDate: new Date("2026-01-01"),
        endDate: null,
        removalReason: null,
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
    ];

    // Forward Step 1: Backup table simulation
    const backupTable: { membershipId: string; originalEndDate: Date | null }[] = [];

    // Identify rows that need backfill
    for (const row of dataset) {
      if ((row.status === "removed" || row.status === "rejected") && row.endDate === null) {
        backupTable.push({
          membershipId: row.id,
          originalEndDate: row.endDate,
        });
      }
    }

    // Verify backup only captured intended rows
    expect(backupTable).toHaveLength(2);
    expect(backupTable.map((b) => b.membershipId)).toEqual([
      "row-removed-null-end",
      "row-rejected-null-end",
    ]);
    expect(backupTable.every((b) => b.originalEndDate === null)).toBe(true);

    // Forward Step 2: Perform update
    const forwardMigratedDataset = dataset.map((row) => {
      if ((row.status === "removed" || row.status === "rejected") && row.endDate === null) {
        return {
          ...row,
          endDate: row.createdAt,
        };
      }
      return row;
    });

    // Verify forward state
    expect(forwardMigratedDataset.find((r) => r.id === "row-removed-null-end")?.endDate).toEqual(
      new Date("2026-01-01T10:00:00Z")
    );
    expect(forwardMigratedDataset.find((r) => r.id === "row-rejected-null-end")?.endDate).toEqual(
      new Date("2026-01-01T11:00:00Z")
    );
    expect(forwardMigratedDataset.find((r) => r.id === "row-removed-existing-end")?.endDate).toEqual(
      new Date("2026-02-01T12:00:00Z")
    );
    expect(forwardMigratedDataset.find((r) => r.id === "row-active-null-end")?.endDate).toBeNull();

    // Rollback Step: Restore from backup table
    const rolledBackDataset = forwardMigratedDataset.map((row) => {
      const backupEntry = backupTable.find((b) => b.membershipId === row.id);
      if (backupEntry) {
        return {
          ...row,
          endDate: backupEntry.originalEndDate,
        };
      }
      return row;
    });

    // Verification: Lossless rollback restoration
    expect(rolledBackDataset).toEqual(dataset);
  });
});
