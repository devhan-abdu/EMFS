import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPairedEditionWithCover } from "../lib/services/create-book";
import { addPairedEditionAction } from "../actions/catalog";

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
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const transactionMock = vi.fn();

  return { selectMock, insertMock, updateMock, transactionMock };
});

const { selectMock, insertMock, updateMock, transactionMock } = mocks;

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
    insert: mocks.insertMock,
    update: mocks.updateMock,
    transaction: mocks.transactionMock,
  },
}));

describe("addPairedEditionWithCover Service", () => {
  const mockStorageService = {
    upload: vi.fn(async ({ key, contentType }) => ({
      key,
      publicUrl: `https://cdn.example.com/${key}`,
      contentType,
    })),
    delete: vi.fn(async () => undefined),
    getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
  };

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

    await expect(
      addPairedEditionWithCover(
        {
          pairedBookId: "550e8400-e29b-41d4-a716-446655440000",
          title: "Blocked Edition",
          language: "am",
        },
        mockStorageService,
      ),
    ).rejects.toMatchObject({ code, message });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("successfully adds a paired edition, inheriting sequence_order and updating links", async () => {
    const targetBook = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Atomic Habits",
      language: "en",
      sequenceOrder: 3,
      pairedBookId: null,
    };

    const newBookRow = {
      id: "660e8400-e29b-41d4-a716-446655440000",
      title: "አቶሚክ ልማዶች",
      language: "am",
      author: "James Clear",
      coverUrl: "covers/amharic.webp",
      sequenceOrder: 3, // SAME SLOT!
      pairedBookId: targetBook.id,
    };

    const txMock = {
      select: vi
        .fn()
        // 1st select: targetBook
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [targetBook]),
            })),
          })),
        })
        // 2nd select: check existing slot language
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        }),
      insert: vi.fn(() => ({
        values: vi.fn((data) => ({
          returning: vi.fn(async () => [
            {
              ...newBookRow,
              ...data,
            },
          ]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => [{ id: targetBook.id }]),
        })),
      })),
    };

    transactionMock.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      return cb(txMock);
    });

    const result = await addPairedEditionWithCover(
      {
        pairedBookId: targetBook.id,
        title: "አቶሚክ ልማዶች",
        language: "am",
        author: "James Clear",
      },
      mockStorageService,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sequenceOrder).toBe(3); // Inherits slot 3
      expect(result.data.language).toBe("am");
      expect(result.data.pairedBookId).toBe(targetBook.id);
    }
    expect(txMock.update).toHaveBeenCalledTimes(1);
  });

  it("returns error if target book does not exist", async () => {
    const txMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []), // Not found
          })),
        })),
      })),
    };

    transactionMock.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      return cb(txMock);
    });

    const result = await addPairedEditionWithCover(
      {
        pairedBookId: "550e8400-e29b-41d4-a716-446655440000",
        title: "Another Book",
        language: "am",
      },
      mockStorageService,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        field: "pairedBookId",
        code: "TARGET_BOOK_NOT_FOUND",
      });
    }
  });

  it("rejects paired edition with same language as target book", async () => {
    const targetBook = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Atomic Habits",
      language: "en",
      sequenceOrder: 1,
    };

    const txMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [targetBook]),
          })),
        })),
      })),
    };

    transactionMock.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      return cb(txMock);
    });

    const result = await addPairedEditionWithCover(
      {
        pairedBookId: targetBook.id,
        title: "Atomic Habits Second Copy",
        language: "en", // SAME as target
      },
      mockStorageService,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        field: "language",
        code: "DUPLICATE_LANGUAGE",
      });
    }
  });

  it("deletes uploaded cover if transaction fails", async () => {
    const deleteMock = vi.fn(async () => undefined);
    const storageService = {
      upload: vi.fn(async ({ key }) => ({
        key,
        publicUrl: `https://cdn.example.com/${key}`,
      })),
      delete: deleteMock,
      getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
    };

    transactionMock.mockRejectedValue(new Error("Transaction crashed"));

    selectMock.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    }));

    const validPng = await sharp({
      create: {
        width: 1200,
        height: 1200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(
      addPairedEditionWithCover(
        {
          pairedBookId: "550e8400-e29b-41d4-a716-446655440000",
          title: "Book with cover",
          language: "am",
          cover: {
            body: new Uint8Array(validPng),
            declaredType: "image/png",
          },
        },
        storageService,
      ),
    ).rejects.toThrow("Transaction crashed");

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});

describe("addPairedEditionAction Server Action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects non-super-admin caller", async () => {
    mockRequireSuperAdmin.mockRejectedValue(
      new AuthzErrorMock(
        "FORBIDDEN",
        "Role 'pace_admin' is not permitted. Required at least: super_admin.",
      ),
    );

    const result = await addPairedEditionAction({
      pairedBookId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Amharic Version",
      language: "am",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toEqual({
        field: "auth",
        code: "FORBIDDEN",
        message: "Role 'pace_admin' is not permitted. Required at least: super_admin.",
      });
    }
  });
});
