import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPairedEditionWithCover } from "../lib/services/catalog/create-book";
import { addPairedEditionAction } from "../actions/catalog";

const mockUploadToCloudinary = vi.hoisted(() => vi.fn());
const mockDeleteFromCloudinary = vi.hoisted(() => vi.fn());

vi.mock("../lib/services/catalog/cloudinary", () => ({
  uploadToCloudinary: mockUploadToCloudinary,
  isCloudinaryUrl: (url: string) => url.includes("res.cloudinary.com"),
  deleteFromCloudinary: mockDeleteFromCloudinary,
}));

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
  beforeEach(() => {
    vi.resetAllMocks();
    mockUploadToCloudinary.mockResolvedValue({
      secureUrl:
        "https://res.cloudinary.com/demo/image/upload/v1/emfs-covers/amharic.webp",
      publicId: "emfs-covers/amharic",
    });
    mockDeleteFromCloudinary.mockResolvedValue(undefined);
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
          pageCount: 200,
        })).rejects.toMatchObject({ code, message });
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
      coverUrl:
        "https://res.cloudinary.com/demo/image/upload/v1/emfs-covers/amharic.webp",
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
        pageCount: 200,
        author: "James Clear",
      });

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
        pageCount: 200,
      });

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
        pageCount: 200,
      });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        field: "language",
        code: "DUPLICATE_LANGUAGE",
      });
    }
  });

  it("returns conflict when a paired edition already exists for the book", async () => {
    const targetBook = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Atomic Habits",
      language: "en",
      sequenceOrder: 1,
      pairedBookId: "660e8400-e29b-41d4-a716-446655440099",
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

    const result = await addPairedEditionWithCover({
      pairedBookId: targetBook.id,
      title: "አቶሚክ ልማዶች (v2)",
      language: "am",
      pageCount: 220,
    });

    expect(result.ok).toBe(false);
    if (!result.ok && "conflict" in result) {
      expect(result.conflict).toBe(true);
      expect(result.existingEditionId).toBe(targetBook.pairedBookId);
      expect(result.message).toMatch(/already exists/i);
    } else {
      expect.fail("Expected a conflict result");
    }
  });

  it("deletes uploaded Cloudinary cover if transaction fails", async () => {
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
          pageCount: 200,
          cover: {
            body: new Uint8Array(validPng),
            declaredType: "image/png",
          },
        })).rejects.toThrow("Transaction crashed");

    expect(mockDeleteFromCloudinary).toHaveBeenCalledTimes(1);
  });

  it("stores an external Google Books cover URL without uploading", async () => {
    const targetBook = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Atomic Habits",
      language: "en",
      sequenceOrder: 3,
      pairedBookId: null,
    };

    const googleCover =
      "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1";

    const txMock = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [targetBook]),
            })),
          })),
        })
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
              id: "660e8400-e29b-41d4-a716-446655440001",
              title: data.title,
              language: data.language,
              coverUrl: data.coverUrl,
              sequenceOrder: 3,
              pairedBookId: targetBook.id,
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
        title: "Atomic Habits Amharic",
        language: "am",
        pageCount: 200,
        coverUrl: googleCover,
      });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.coverUrl).toBe(googleCover);
    }
    expect(mockUploadToCloudinary).not.toHaveBeenCalled();
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
        "Role 'pace_admin' is not permitted. Required at least: super_admin."));

    const result = await addPairedEditionAction({
      pairedBookId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Amharic Version",
      language: "am",
      pageCount: 200,
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
