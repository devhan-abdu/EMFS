import { beforeEach, describe, expect, it, vi } from "vitest";
import { reorderCatalogSlots } from "../lib/services/reorder-catalog";
import { reorderCatalogSlotsAction } from "../actions/catalog";

const { mockRequireSuperAdmin, AuthzErrorMock } = vi.hoisted(() => {
  class AuthzErrorMock extends Error {
    code: "UNAUTHENTICATED" | "FORBIDDEN";
    constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
      super(message);
      this.code = code;
    }
  }

  const mockRequireSuperAdmin = vi.fn();
  return { mockRequireSuperAdmin, AuthzErrorMock };
});

const mocks = vi.hoisted(() => {
  const selectMock = vi.fn();
  const updateMock = vi.fn();
  const transactionMock = vi.fn();

  return { selectMock, updateMock, transactionMock };
});

const { selectMock, updateMock, transactionMock } = mocks;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/authorize", () => ({
  AuthzError: AuthzErrorMock,
  requireSuperAdmin: mockRequireSuperAdmin,
  authzErrorToFieldError: vi.fn((error: InstanceType<typeof AuthzErrorMock>) => ({
    field: "auth",
    message: error.message,
    code: error.code,
  })),
}));

vi.mock("@/db", () => ({
  db: {
    select: mocks.selectMock,
    update: mocks.updateMock,
    transaction: mocks.transactionMock,
  },
}));

describe("reorderCatalogSlots Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    ["UNAUTHENTICATED", "You must be signed in."],
    ["FORBIDDEN", "Role 'member' is not permitted."],
    ["FORBIDDEN", "Role 'pace_admin' is not permitted."],
    ["FORBIDDEN", "Role 'batch_admin' is not permitted."],
  ] as const)("rejects direct calls for %s callers", async (code, message) => {
    mockRequireSuperAdmin.mockRejectedValueOnce(new AuthzErrorMock(code, message));

    await expect(reorderCatalogSlots({ fromSlot: 2, toSlot: 1 })).rejects.toMatchObject({
      code,
      message,
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("handles identical source and destination as a no-op", async () => {
    const result = await reorderCatalogSlots({ fromSlot: 3, toSlot: 3 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        fromSlot: 3,
        toSlot: 3,
        movedSlotsCount: 0,
      });
    }
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("reorders downwards (e.g. moving slot 4 to slot 2)", async () => {
    const updates: Array<{ sequenceOrder: unknown }> = [];

    const txMock = {
      select: vi
        .fn()
        // 1st select: maxSlot stats
        .mockReturnValueOnce({
          from: vi.fn(async () => [{ maxSlot: 5 }]),
        })
        // 2nd select: fromSlot check
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "book-4" }]),
            })),
          })),
        }),
      update: vi.fn(() => ({
        set: vi.fn((setData) => {
          updates.push(setData);
          return {
            where: vi.fn(async () => undefined),
          };
        }),
      })),
    };

    transactionMock.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      return cb(txMock);
    });

    const result = await reorderCatalogSlots({ fromSlot: 4, toSlot: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        fromSlot: 4,
        toSlot: 2,
        movedSlotsCount: 3,
      });
    }

    // Check 3-step update sequence:
    // 1. Move to temporary negative slot (-4)
    expect(updates[0].sequenceOrder).toBe(-4);
    // 2. Shift intermediate slots (2..3 -> 3..4)
    expect(updates[1].sequenceOrder).toBeDefined();
    // 3. Move temporary slot to target slot (2)
    expect(updates[2].sequenceOrder).toBe(2);
  });

  it("reorders upwards (e.g. moving slot 2 to slot 4)", async () => {
    const updates: Array<{ sequenceOrder: unknown }> = [];

    const txMock = {
      select: vi
        .fn()
        // 1st select: maxSlot stats
        .mockReturnValueOnce({
          from: vi.fn(async () => [{ maxSlot: 5 }]),
        })
        // 2nd select: fromSlot check
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "book-2" }]),
            })),
          })),
        }),
      update: vi.fn(() => ({
        set: vi.fn((setData) => {
          updates.push(setData);
          return {
            where: vi.fn(async () => undefined),
          };
        }),
      })),
    };

    transactionMock.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      return cb(txMock);
    });

    const result = await reorderCatalogSlots({ fromSlot: 2, toSlot: 4 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        fromSlot: 2,
        toSlot: 4,
        movedSlotsCount: 3,
      });
    }

    expect(updates[0].sequenceOrder).toBe(-2);
    expect(updates[2].sequenceOrder).toBe(4);
  });

  it("rejects out of bounds fromSlot", async () => {
    const txMock = {
      select: vi.fn().mockReturnValueOnce({
        from: vi.fn(async () => [{ maxSlot: 3 }]),
      }),
    };

    transactionMock.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      return cb(txMock);
    });

    const result = await reorderCatalogSlots({ fromSlot: 10, toSlot: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        field: "fromSlot",
        code: "SLOT_NOT_FOUND",
      });
    }
  });

  it("rejects out of bounds toSlot", async () => {
    const txMock = {
      select: vi.fn().mockReturnValueOnce({
        from: vi.fn(async () => [{ maxSlot: 3 }]),
      }),
    };

    transactionMock.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      return cb(txMock);
    });

    const result = await reorderCatalogSlots({ fromSlot: 2, toSlot: 99 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        field: "toSlot",
        code: "SLOT_OUT_OF_BOUNDS",
      });
    }
  });
});

describe("reorderCatalogSlotsAction Server Action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated and non-super-admin caller", async () => {
    mockRequireSuperAdmin.mockRejectedValue(
      new AuthzErrorMock("FORBIDDEN", "Role 'member' is not permitted. Required at least: super_admin."),
    );

    const result = await reorderCatalogSlotsAction({ fromSlot: 2, toSlot: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toEqual({
        field: "auth",
        code: "FORBIDDEN",
        message: "Role 'member' is not permitted. Required at least: super_admin.",
      });
    }
  });

  it("rejects invalid input schemas", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      authUserId: "admin-1",
      email: "admin@example.com",
      profile: { role: "super_admin" },
    });

    const result = await reorderCatalogSlotsAction({ fromSlot: -1, toSlot: "abc" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
