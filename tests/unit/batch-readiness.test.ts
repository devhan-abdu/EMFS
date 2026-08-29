import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isCatalogReady,
  getBatchAdminCount,
  getActualPaceGroupCount,
  arePaceAdminsAssigned,
  computeBatchReadiness,
  getBatchReadinessStatuses,
  getAdminBatchIds,
} from "@/lib/services/batch-readiness";

// ---------------------------------------------------------------------------
// Mock DB — uses a call-sequence based approach to handle multiple
// select().from().where() chains in the same function call.
// ---------------------------------------------------------------------------

let selectCallIndex = 0;
let selectReturnValues: Array<{
  fromReturn: {
    whereReturn: unknown;
    directReturn?: unknown;
  };
}> = [];

function queueSelect(opts: {
  /** Value returned by .where() — either a resolved value or an object with chain methods */
  whereReturn?: unknown;
  /** If provided, .from() resolves directly (no .where() call needed, e.g. isCatalogReady) */
  directFromReturn?: unknown;
}) {
  selectReturnValues.push({
    fromReturn: {
      whereReturn: opts.whereReturn,
      directReturn: opts.directFromReturn,
    },
  });
}

/** Queue a select that terminates at .from().where() → resolved value */
function queueSimpleSelect(resolvedValue: unknown) {
  queueSelect({ whereReturn: resolvedValue });
}

/** Queue a select that terminates at .from() directly (no .where()) */
function queueDirectSelect(resolvedValue: unknown) {
  queueSelect({ directFromReturn: resolvedValue });
}

/** Queue a select that chains .where().orderBy().limit().offset() → resolved value */
function queuePaginatedSelect(resolvedValue: unknown) {
  queueSelect({
    whereReturn: {
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue(resolvedValue),
        }),
      }),
    },
  });
}

const mockSelect = vi.fn().mockImplementation(() => ({
  from: vi.fn().mockImplementation(() => {
    const idx = selectCallIndex++;
    const config = selectReturnValues[idx];
    if (!config) {
      throw new Error(`No queued select return for call index ${idx}`);
    }
    if (config.fromReturn.directReturn !== undefined) {
      return config.fromReturn.directReturn;
    }
    return {
      where: vi.fn().mockImplementation(() => config.fromReturn.whereReturn),
    };
  }),
}));

vi.mock("@/db", () => ({
  db: {
    get select() {
      return mockSelect;
    },
  },
}));

function resetMocks() {
  selectCallIndex = 0;
  selectReturnValues = [];
}

// ---------------------------------------------------------------------------
// isCatalogReady
// ---------------------------------------------------------------------------
describe("Batch Readiness - isCatalogReady", () => {
  beforeEach(resetMocks);

  it("returns true when at least 1 book exists", async () => {
    queueDirectSelect([{ bookCount: 5 }]);
    expect(await isCatalogReady()).toBe(true);
  });

  it("returns false when 0 books exist", async () => {
    queueDirectSelect([{ bookCount: 0 }]);
    expect(await isCatalogReady()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getBatchAdminCount
// ---------------------------------------------------------------------------
describe("Batch Readiness - getBatchAdminCount", () => {
  beforeEach(resetMocks);

  it("returns the correct admin count", async () => {
    queueSimpleSelect([{ adminCount: 2 }]);
    expect(await getBatchAdminCount("b1")).toBe(2);
  });

  it("returns 0 when no admins assigned", async () => {
    queueSimpleSelect([{ adminCount: 0 }]);
    expect(await getBatchAdminCount("b1")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getActualPaceGroupCount
// ---------------------------------------------------------------------------
describe("Batch Readiness - getActualPaceGroupCount", () => {
  beforeEach(resetMocks);

  it("returns the actual pace group count", async () => {
    queueSimpleSelect([{ groupCount: 3 }]);
    expect(await getActualPaceGroupCount("b1")).toBe(3);
  });

  it("returns 0 when no pace groups exist", async () => {
    queueSimpleSelect([{ groupCount: 0 }]);
    expect(await getActualPaceGroupCount("b1")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// arePaceAdminsAssigned
// ---------------------------------------------------------------------------
describe("Batch Readiness - arePaceAdminsAssigned", () => {
  beforeEach(resetMocks);

  it("returns false when no pace groups exist", async () => {
    queueSimpleSelect([]);  // pace groups query → empty
    expect(await arePaceAdminsAssigned("b1")).toBe(false);
  });

  it("returns true when all pace groups have ≥1 admin", async () => {
    queueSimpleSelect([{ id: "pg1" }, { id: "pg2" }]);   // pace groups
    queueSimpleSelect([{ coveredGroups: 2 }]);             // covered count
    expect(await arePaceAdminsAssigned("b1")).toBe(true);
  });

  it("returns false when not all pace groups have admins", async () => {
    queueSimpleSelect([{ id: "pg1" }, { id: "pg2" }, { id: "pg3" }]);
    queueSimpleSelect([{ coveredGroups: 1 }]);
    expect(await arePaceAdminsAssigned("b1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeBatchReadiness
// ---------------------------------------------------------------------------
describe("Batch Readiness - computeBatchReadiness", () => {
  const base = {
    id: "b1",
    name: "Test",
    paceGroupCount: 2,
    startDate: "2026-09-01" as string | null,
    readingDaysPerWeek: 7 as number | null,
    registrationOpen: false,
  };

  beforeEach(resetMocks);

  function mockFullyReady() {
    queueSimpleSelect([{ adminCount: 2 }]);              // getBatchAdminCount
    queueSimpleSelect([{ groupCount: 2 }]);              // getActualPaceGroupCount
    queueSimpleSelect([{ id: "pg1" }, { id: "pg2" }]);   // arePaceAdminsAssigned → groups
    queueSimpleSelect([{ coveredGroups: 2 }]);            // arePaceAdminsAssigned → covered
  }

  it("computes all flags for fully ready batch", async () => {
    mockFullyReady();
    const r = await computeBatchReadiness({ ...base, registrationOpen: true }, true);
    expect(r).toEqual({
      batchId: "b1",
      batchName: "Test",
      catalogReady: true,
      batchAdminsAssigned: true,
      paceGroupsReady: true,
      paceAdminsAssigned: true,
      pacingConfirmed: true,
      registrationOpen: true,
    });
  });

  it("batchAdminsAssigned=false when 0 admins", async () => {
    queueSimpleSelect([{ adminCount: 0 }]);
    queueSimpleSelect([{ groupCount: 2 }]);
    queueSimpleSelect([{ id: "pg1" }, { id: "pg2" }]);
    queueSimpleSelect([{ coveredGroups: 2 }]);
    expect((await computeBatchReadiness(base, true)).batchAdminsAssigned).toBe(false);
  });

  it("batchAdminsAssigned=true for 1 admin", async () => {
    queueSimpleSelect([{ adminCount: 1 }]);
    queueSimpleSelect([{ groupCount: 2 }]);
    queueSimpleSelect([{ id: "pg1" }, { id: "pg2" }]);
    queueSimpleSelect([{ coveredGroups: 2 }]);
    expect((await computeBatchReadiness(base, true)).batchAdminsAssigned).toBe(true);
  });

  it("batchAdminsAssigned=true for 3 admins", async () => {
    queueSimpleSelect([{ adminCount: 3 }]);
    queueSimpleSelect([{ groupCount: 2 }]);
    queueSimpleSelect([{ id: "pg1" }, { id: "pg2" }]);
    queueSimpleSelect([{ coveredGroups: 2 }]);
    expect((await computeBatchReadiness(base, true)).batchAdminsAssigned).toBe(true);
  });

  it("paceGroupsReady=false when actual ≠ expected", async () => {
    queueSimpleSelect([{ adminCount: 2 }]);
    queueSimpleSelect([{ groupCount: 1 }]);
    queueSimpleSelect([{ id: "pg1" }]);
    queueSimpleSelect([{ coveredGroups: 1 }]);
    expect((await computeBatchReadiness(base, true)).paceGroupsReady).toBe(false);
  });

  it("pacingConfirmed=false when startDate null", async () => {
    mockFullyReady();
    expect(
      (await computeBatchReadiness({ ...base, startDate: null }, true)).pacingConfirmed
    ).toBe(false);
  });

  it("pacingConfirmed=false when readingDaysPerWeek null", async () => {
    mockFullyReady();
    expect(
      (await computeBatchReadiness({ ...base, readingDaysPerWeek: null }, true)).pacingConfirmed
    ).toBe(false);
  });

  it("catalogReady=false when passed false", async () => {
    mockFullyReady();
    expect((await computeBatchReadiness(base, false)).catalogReady).toBe(false);
  });

  it("registrationOpen mirrors batch field", async () => {
    mockFullyReady();
    expect((await computeBatchReadiness(base, true)).registrationOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getBatchReadinessStatuses (pagination)
// ---------------------------------------------------------------------------
describe("Batch Readiness - getBatchReadinessStatuses", () => {
  beforeEach(resetMocks);

  it("enforces minimum page=1 and pageSize≥1", async () => {
    queueSimpleSelect([{ total: 0 }]);        // count query
    queuePaginatedSelect([]);                   // paginated rows
    queueDirectSelect([{ bookCount: 0 }]);     // catalog check

    const r = await getBatchReadinessStatuses(0, -5);
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(1);
    expect(r.items).toEqual([]);
  });

  it("returns correct pagination metadata", async () => {
    queueSimpleSelect([{ total: 45 }]);
    queuePaginatedSelect([]);
    queueDirectSelect([{ bookCount: 1 }]);

    const r = await getBatchReadinessStatuses(2, 20);
    expect(r.page).toBe(2);
    expect(r.pageSize).toBe(20);
    expect(r.total).toBe(45);
    expect(r.totalPages).toBe(3);
  });

  it("computes readiness for each batch in result", async () => {
    const batch = {
      id: "b-1",
      name: "Batch 1",
      maxMembers: 50,
      paceGroupCount: 1,
      registrationOpen: true,
      autoApprove: true,
      startDate: "2026-09-01",
      readingDaysPerWeek: 7,
      createdBy: "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queueSimpleSelect([{ total: 1 }]);          // count
    queuePaginatedSelect([batch]);               // rows
    queueDirectSelect([{ bookCount: 3 }]);       // catalog
    // computeBatchReadiness for b-1
    queueSimpleSelect([{ adminCount: 1 }]);
    queueSimpleSelect([{ groupCount: 1 }]);
    queueSimpleSelect([{ id: "pg1" }]);
    queueSimpleSelect([{ coveredGroups: 1 }]);

    const r = await getBatchReadinessStatuses(1, 20);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toEqual({
      batchId: "b-1",
      batchName: "Batch 1",
      catalogReady: true,
      batchAdminsAssigned: true,
      paceGroupsReady: true,
      paceAdminsAssigned: true,
      pacingConfirmed: true,
      registrationOpen: true,
    });
  });
});

// ---------------------------------------------------------------------------
// getAdminBatchIds
// ---------------------------------------------------------------------------
describe("Batch Readiness - getAdminBatchIds", () => {
  beforeEach(resetMocks);

  it("returns batch IDs for a given admin profile", async () => {
    queueSimpleSelect([{ batchId: "b1" }, { batchId: "b2" }]);
    expect(await getAdminBatchIds("p1")).toEqual(["b1", "b2"]);
  });

  it("returns empty array when no assignments", async () => {
    queueSimpleSelect([]);
    expect(await getAdminBatchIds("p1")).toEqual([]);
  });
});
