import { describe, it, expect, vi } from "vitest";

// Allow modules that start with `import "server-only"` to load in Node/Vitest.
vi.mock("server-only", () => ({}));

// Stub the DB so the module can import without a real Postgres connection.
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Stub the auth session to satisfy the CurrentUser type import.
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(),
}));

// Stub the auth lib to satisfy the authorize import used inside
// getAdminBatchesPaginated (dynamic import — stub is still needed for module
// resolution during the static analysis phase).
vi.mock("@/lib/auth/authorize", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
  requireMinRole: vi.fn(),
  requireSuperAdmin: vi.fn(),
  AuthzError: class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "AuthzError";
    }
  },
}));

import { computeReadiness } from "@/lib/services/admin";
import type { BatchReadiness } from "@/lib/services/admin";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a fully-satisfied BatchReadiness["details"] for use as a base. */
function fullyReadyDetails(): BatchReadiness["details"] {
  return {
    catalogBooksCount: 3,
    assignedBatchAdminCount: 2,
    plannedPaceGroupCount: 3,
    actualPaceGroupCount: 3,
    paceGroupsWithoutAdminCount: 0,
    startDate: "2026-09-01",
    readingDaysPerWeek: 6,
    registrationOpen: true,
    paceGroupPaces: [5, 10, 20],
  };
}

function readiness(
  overrides: Partial<BatchReadiness["details"]>,
): BatchReadiness {
  return computeReadiness({ ...fullyReadyDetails(), ...overrides });
}

// ── catalog_ready ─────────────────────────────────────────────────────────────

describe("computeReadiness — catalog_ready", () => {
  it("is false when catalogBooksCount is 0", () => {
    expect(readiness({ catalogBooksCount: 0 }).catalog_ready).toBe(false);
  });

  it("is true when catalogBooksCount is 1", () => {
    expect(readiness({ catalogBooksCount: 1 }).catalog_ready).toBe(true);
  });

  it("is true when catalogBooksCount is large", () => {
    expect(readiness({ catalogBooksCount: 50 }).catalog_ready).toBe(true);
  });
});

// ── batch_admins_assigned ─────────────────────────────────────────────────────

describe("computeReadiness — batch_admins_assigned", () => {
  it("is false when 0 admins assigned", () => {
    expect(readiness({ assignedBatchAdminCount: 0 }).batch_admins_assigned).toBe(false);
  });

  it("is true for 1 admin", () => {
    expect(readiness({ assignedBatchAdminCount: 1 }).batch_admins_assigned).toBe(true);
  });

  it("is true for 2 admins", () => {
    expect(readiness({ assignedBatchAdminCount: 2 }).batch_admins_assigned).toBe(true);
  });

  it("is true for 3 admins (upper bound)", () => {
    expect(readiness({ assignedBatchAdminCount: 3 }).batch_admins_assigned).toBe(true);
  });

  it("is false for 4 admins (over limit)", () => {
    expect(readiness({ assignedBatchAdminCount: 4 }).batch_admins_assigned).toBe(false);
  });
});

// ── pace_groups_ready ─────────────────────────────────────────────────────────

describe("computeReadiness — pace_groups_ready", () => {
  it("is false when actual < planned", () => {
    expect(
      readiness({ actualPaceGroupCount: 1, plannedPaceGroupCount: 3 })
        .pace_groups_ready,
    ).toBe(false);
  });

  it("is false when actual > planned", () => {
    expect(
      readiness({ actualPaceGroupCount: 4, plannedPaceGroupCount: 3 })
        .pace_groups_ready,
    ).toBe(false);
  });

  it("is true when actual === planned", () => {
    expect(
      readiness({ actualPaceGroupCount: 3, plannedPaceGroupCount: 3 })
        .pace_groups_ready,
    ).toBe(true);
  });

  it("is true when both are 0 (batch not configured yet)", () => {
    // 0 planned and 0 actual is technically equal — domain allows this at creation.
    expect(
      readiness({ actualPaceGroupCount: 0, plannedPaceGroupCount: 0 })
        .pace_groups_ready,
    ).toBe(true);
  });
});

// ── pace_admins_assigned ──────────────────────────────────────────────────────

describe("computeReadiness — pace_admins_assigned", () => {
  it("is false when actualPaceGroupCount is 0", () => {
    expect(
      readiness({ actualPaceGroupCount: 0, paceGroupsWithoutAdminCount: 0 })
        .pace_admins_assigned,
    ).toBe(false);
  });

  it("is false when any group is missing an admin", () => {
    expect(
      readiness({ actualPaceGroupCount: 3, paceGroupsWithoutAdminCount: 1 })
        .pace_admins_assigned,
    ).toBe(false);
  });

  it("is false when all groups are missing admins", () => {
    expect(
      readiness({ actualPaceGroupCount: 3, paceGroupsWithoutAdminCount: 3 })
        .pace_admins_assigned,
    ).toBe(false);
  });

  it("is true when all groups have at least 1 admin", () => {
    expect(
      readiness({ actualPaceGroupCount: 3, paceGroupsWithoutAdminCount: 0 })
        .pace_admins_assigned,
    ).toBe(true);
  });
});

// ── pacing_confirmed ──────────────────────────────────────────────────────────

describe("computeReadiness — pacing_confirmed", () => {
  it("is false when startDate is null", () => {
    expect(readiness({ startDate: null }).pacing_confirmed).toBe(false);
  });

  it("is false when readingDaysPerWeek is 0", () => {
    expect(readiness({ readingDaysPerWeek: 0 }).pacing_confirmed).toBe(false);
  });

  it("is false when actualPaceGroupCount is 0 (no pace groups yet)", () => {
    expect(
      readiness({ actualPaceGroupCount: 0, paceGroupPaces: [] }).pacing_confirmed,
    ).toBe(false);
  });

  it("is false when any pace group has size 0", () => {
    expect(
      readiness({ paceGroupPaces: [10, 0, 20] }).pacing_confirmed,
    ).toBe(false);
  });

  it("is false when paceGroupPaces is empty but actualPaceGroupCount > 0", () => {
    // Defensive: should not happen in practice but the logic must handle it.
    expect(
      readiness({ actualPaceGroupCount: 2, paceGroupPaces: [] }).pacing_confirmed,
    ).toBe(false);
  });

  it("is true when startDate set, readingDaysPerWeek > 0, and all sizes > 0", () => {
    expect(
      readiness({
        startDate: "2026-09-01",
        readingDaysPerWeek: 5,
        actualPaceGroupCount: 2,
        paceGroupPaces: [10, 20],
      }).pacing_confirmed,
    ).toBe(true);
  });

  it("is true with a single pace group of size 5 pages/day", () => {
    expect(
      readiness({
        startDate: "2026-10-01",
        readingDaysPerWeek: 7,
        actualPaceGroupCount: 1,
        paceGroupPaces: [5],
      }).pacing_confirmed,
    ).toBe(true);
  });
});

// ── registration_open ─────────────────────────────────────────────────────────

describe("computeReadiness — registration_open", () => {
  it("is false when registrationOpen is false", () => {
    expect(readiness({ registrationOpen: false }).registration_open).toBe(false);
  });

  it("is true when registrationOpen is true", () => {
    expect(readiness({ registrationOpen: true }).registration_open).toBe(true);
  });
});

// ── score + isReady ───────────────────────────────────────────────────────────

describe("computeReadiness — score and isReady", () => {
  it("reports score 6 and isReady true when all checks pass", () => {
    const r = computeReadiness(fullyReadyDetails());
    expect(r.score).toBe(6);
    expect(r.total).toBe(6);
    expect(r.isReady).toBe(true);
  });

  it("reports score 0 and isReady false when nothing is configured", () => {
    const r = computeReadiness({
      catalogBooksCount: 0,
      assignedBatchAdminCount: 0,
      plannedPaceGroupCount: 3,
      actualPaceGroupCount: 0,
      paceGroupsWithoutAdminCount: 0,
      startDate: null,
      readingDaysPerWeek: 0,
      registrationOpen: false,
      paceGroupPaces: [],
    });
    expect(r.score).toBe(0);
    expect(r.isReady).toBe(false);
  });

  it("reports correct partial score — 4 of 6", () => {
    // catalog_ready + batch_admins_assigned + pace_groups_ready + pace_admins_assigned
    // but NOT pacing_confirmed (no startDate) and NOT registration_open
    const r = readiness({
      startDate: null,
      registrationOpen: false,
    });
    expect(r.catalog_ready).toBe(true);
    expect(r.batch_admins_assigned).toBe(true);
    expect(r.pace_groups_ready).toBe(true);
    expect(r.pace_admins_assigned).toBe(true);
    expect(r.pacing_confirmed).toBe(false);
    expect(r.registration_open).toBe(false);
    expect(r.score).toBe(4);
    expect(r.isReady).toBe(false);
  });
});

// ── details passthrough ───────────────────────────────────────────────────────

describe("computeReadiness — details passthrough", () => {
  it("echoes all input details into the result", () => {
    const input = fullyReadyDetails();
    const r = computeReadiness(input);
    expect(r.details).toStrictEqual(input);
  });
});
