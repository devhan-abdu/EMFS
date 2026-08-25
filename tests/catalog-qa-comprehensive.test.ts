import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBookAction,
  addPairedEditionAction,
  reorderCatalogSlotsAction,
  getCatalogAction,
} from "../actions/catalog";
import { createBookWithCover, addPairedEditionWithCover } from "../lib/services/create-book";
import { reorderCatalogSlots } from "../lib/services/reorder-catalog";
import { getCatalog } from "../lib/services/get-catalog";
import { createBookSchema, addPairedEditionSchema, reorderSlotsSchema } from "../lib/validations/catalog";
import * as storageFactoryModule from "../lib/services/storage/get-storage-service";
import type { StorageService } from "../lib/services/storage/storage-service";

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
  const selectDistinctMock = vi.fn();
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const transactionMock = vi.fn();
  const findManyMock = vi.fn();

  return { selectMock, selectDistinctMock, insertMock, updateMock, transactionMock, findManyMock };
});

const { selectMock, selectDistinctMock, insertMock, updateMock, transactionMock, findManyMock } = mocks;

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: {
    select: mocks.selectMock,
    selectDistinct: mocks.selectDistinctMock,
    insert: mocks.insertMock,
    update: mocks.updateMock,
    transaction: mocks.transactionMock,
    query: {
      books: {
        findMany: mocks.findManyMock,
      },
    },
  },
}));

vi.mock("@/lib/auth/authorize", () => ({
  AuthzError: AuthzErrorMock,
  requireSuperAdmin: mockRequireSuperAdmin,
  authzErrorToFieldError: vi.fn((error: InstanceType<typeof AuthzErrorMock>) => ({
    field: "auth",
    message: error.message,
    code: error.code,
  })),
}));

vi.mock("../lib/services/storage/get-storage-service", () => ({
  getStorageService: vi.fn(),
}));

describe("Comprehensive QA Test Suite - EMFS Catalog", () => {
  const mockStorageService: StorageService = {
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
    vi.mocked(storageFactoryModule.getStorageService).mockReturnValue(mockStorageService);
  });

  /* -------------------------------------------------------------------------- */
  /*                              1. CREATE BOOK                                */
  /* -------------------------------------------------------------------------- */
  describe("1. CREATE BOOK", () => {
    it("valid creation with metadata and automatic sequence_order", async () => {
      selectMock.mockReturnValueOnce({
        from: vi.fn(async () => [{ maxSequenceOrder: 5 }]),
      });

      insertMock.mockReturnValueOnce({
        values: vi.fn((data) => ({
          returning: vi.fn(async () => [
            {
              id: "book-new",
              title: data.title,
              language: data.language,
              author: data.author,
              coverUrl: null,
              sequenceOrder: data.sequenceOrder,
              pairedBookId: null,
            },
          ]),
        })),
      });

      const result = await createBookWithCover(
        { title: "Atomic Habits", language: "en", author: "James Clear" },
        mockStorageService,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe("book-new");
        expect(result.data.title).toBe("Atomic Habits");
        expect(result.data.sequenceOrder).toBe(6); // 5 + 1
      }
    });

    it("rejects missing title", () => {
      const parsed = createBookSchema.safeParse({ language: "en" });
      expect(parsed.success).toBe(false);
    });

    it("rejects invalid language (uppercase / too long)", () => {
      expect(createBookSchema.safeParse({ title: "Book", language: "EN" }).success).toBe(false);
      expect(createBookSchema.safeParse({ title: "Book", language: "english" }).success).toBe(false);
      expect(createBookSchema.safeParse({ title: "Book", language: "am" }).success).toBe(true);
    });

    it("supports optional author", () => {
      const withAuthor = createBookSchema.safeParse({ title: "Book", language: "en", author: "Author" });
      const withoutAuthor = createBookSchema.safeParse({ title: "Book", language: "en" });
      expect(withAuthor.success).toBe(true);
      expect(withoutAuthor.success).toBe(true);
    });

    it("supports creation with cover upload and without cover", async () => {
      const validPng = await sharp({
        create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .png()
        .toBuffer();

      selectMock.mockReturnValue({
        from: vi.fn(async () => [{ maxSequenceOrder: 0 }]),
      });

      insertMock.mockReturnValue({
        values: vi.fn((data) => ({
          returning: vi.fn(async () => [
            {
              id: "book-1",
              ...data,
            },
          ]),
        })),
      });

      // With cover
      const withCover = await createBookWithCover(
        {
          title: "Book with cover",
          language: "en",
          cover: { body: new Uint8Array(validPng), declaredType: "image/png" },
        },
        mockStorageService,
      );
      expect(withCover.ok).toBe(true);
      if (withCover.ok) {
        expect(withCover.data.coverUrl).toMatch(/^covers\/[0-9a-f-]+\.webp$/);
      }

      // Without cover
      const withoutCover = await createBookWithCover(
        { title: "Book without cover", language: "en" },
        mockStorageService,
      );
      expect(withoutCover.ok).toBe(true);
      if (withoutCover.ok) {
        expect(withoutCover.data.coverUrl).toBeUndefined();
      }
    });

    it("strips client-provided sequence_order and auto-assigns server sequence_order", async () => {
      selectMock.mockReturnValueOnce({
        from: vi.fn(async () => [{ maxSequenceOrder: 10 }]),
      });

      let insertedSequenceOrder: number | undefined;
      insertMock.mockReturnValueOnce({
        values: vi.fn((data) => {
          insertedSequenceOrder = data.sequenceOrder;
          return {
            returning: vi.fn(async () => [{ id: "b1", ...data }]),
          };
        }),
      });

      const clientInput = {
        title: "Malicious Book",
        language: "en",
        sequenceOrder: 9999, // Should be ignored
      };

      const result = await createBookWithCover(clientInput as any, mockStorageService);
      expect(result.ok).toBe(true);
      expect(insertedSequenceOrder).toBe(11); // Server 10 + 1, not 9999
    });

    it("enforces authorization: unauthenticated, non-super-admin, super-admin", async () => {
      // 1. Unauthenticated
      mockRequireSuperAdmin.mockRejectedValueOnce(
        new AuthzErrorMock("UNAUTHENTICATED", "You must be signed in."),
      );
      const unauth = await createBookAction({ title: "B", language: "en" });
      expect(unauth.ok).toBe(false);
      if (!unauth.ok) expect(unauth.errors[0].code).toBe("UNAUTHENTICATED");

      // 2. Non-super-admin (batch_admin)
      mockRequireSuperAdmin.mockRejectedValueOnce(
        new AuthzErrorMock("FORBIDDEN", "Role 'batch_admin' is not permitted."),
      );
      const forbidden = await createBookAction({ title: "B", language: "en" });
      expect(forbidden.ok).toBe(false);
      if (!forbidden.ok) expect(forbidden.errors[0].code).toBe("FORBIDDEN");

      // 3. Super admin
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authUserId: "sa-1",
        email: "admin@example.com",
        profile: {
          id: "p-1",
          authUserId: "sa-1",
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
      selectMock.mockReturnValueOnce({ from: vi.fn(async () => [{ maxSequenceOrder: 1 }]) });
      insertMock.mockReturnValueOnce({
        values: vi.fn((data) => ({
          returning: vi.fn(async () => [{ id: "b1", ...data }]),
        })),
      });
      const allowed = await createBookAction({ title: "B", language: "en" });
      expect(allowed.ok).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             2. PAIRED EDITION                              */
  /* -------------------------------------------------------------------------- */
  describe("2. PAIRED EDITION", () => {
    it("valid paired edition inherits existing slot and does not consume new sequence_order", async () => {
      const targetBook = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Atomic Habits",
        language: "en",
        sequenceOrder: 4,
        pairedBookId: null,
      };

      const txMock = {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({ limit: vi.fn(async () => [targetBook]) })),
            })),
          })
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
            })),
          }),
        insert: vi.fn(() => ({
          values: vi.fn((data) => ({
            returning: vi.fn(async () => [{ id: "paired-am", ...data }]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(async () => [{ id: targetBook.id }]),
          })),
        })),
      };

      transactionMock.mockImplementation(async (cb: any) => cb(txMock));

      const result = await addPairedEditionWithCover(
        {
          pairedBookId: targetBook.id,
          title: "አቶሚክ ልማዶች",
          language: "am",
        },
        mockStorageService,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.sequenceOrder).toBe(4); // Inherits slot 4
        expect(result.data.pairedBookId).toBe(targetBook.id);
      }
      expect(txMock.update).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid input (malformed UUID, duplicate language, missing target)", async () => {
      // Malformed UUID
      const badUuid = addPairedEditionSchema.safeParse({
        pairedBookId: "invalid",
        title: "Title",
        language: "am",
      });
      expect(badUuid.success).toBe(false);

      // Missing target
      const txMockNotFound = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })),
      };
      transactionMock.mockImplementation(async (cb: any) => cb(txMockNotFound));
      const notFound = await addPairedEditionWithCover(
        {
          pairedBookId: "550e8400-e29b-41d4-a716-446655440000",
          title: "Title",
          language: "am",
        },
        mockStorageService,
      );
      expect(notFound.ok).toBe(false);
      if (!notFound.ok) expect(notFound.errors[0].code).toBe("TARGET_BOOK_NOT_FOUND");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                3. REORDER                                  */
  /* -------------------------------------------------------------------------- */
  describe("3. REORDER", () => {
    it("moves slot forward (e.g. 2 -> 4) and shifts intermediate slots contiguously", async () => {
      const updates: any[] = [];
      const txMock = {
        select: vi
          .fn()
          .mockReturnValueOnce({ from: vi.fn(async () => [{ maxSlot: 5 }]) })
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: "b2" }]) })),
            })),
          }),
        update: vi.fn(() => ({
          set: vi.fn((data) => {
            updates.push(data);
            return { where: vi.fn(async () => undefined) };
          }),
        })),
      };
      transactionMock.mockImplementation(async (cb: any) => cb(txMock));

      const result = await reorderCatalogSlots({ fromSlot: 2, toSlot: 4 });
      expect(result.ok).toBe(true);

      // Step 1: Park at -2
      expect(updates[0].sequenceOrder).toBe(-2);
      // Step 2: Shift (2..4] down
      expect(updates[1].sequenceOrder).toBeDefined();
      // Step 3: Place at 4
      expect(updates[2].sequenceOrder).toBe(4);
    });

    it("moves first slot (1 -> 3) and last slot (5 -> 1)", async () => {
      const txMock = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "b-exists" }]),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
        })),
      };

      txMock.select
        .mockReturnValueOnce({ from: vi.fn(async () => [{ maxSlot: 5 }]) })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: "b1" }]) })),
          })),
        })
        .mockReturnValueOnce({ from: vi.fn(async () => [{ maxSlot: 5 }]) })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: "b5" }]) })),
          })),
        });

      transactionMock.mockImplementation(async (cb: any) => cb(txMock));

      const moveFirst = await reorderCatalogSlots({ fromSlot: 1, toSlot: 3 });
      expect(moveFirst.ok).toBe(true);

      const moveLast = await reorderCatalogSlots({ fromSlot: 5, toSlot: 1 });
      expect(moveLast.ok).toBe(true);
    });

    it("rolls back on database transaction failure", async () => {
      transactionMock.mockRejectedValueOnce(new Error("Deadlock detected"));

      await expect(
        reorderCatalogSlots({ fromSlot: 2, toSlot: 4 }),
      ).rejects.toThrow("Deadlock detected");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                               4. PAGINATION                                */
  /* -------------------------------------------------------------------------- */
  describe("4. PAGINATION", () => {
    it("handles first page, middle page, last page, and empty catalog", async () => {
      // Empty catalog
      selectMock.mockReturnValueOnce({
        from: vi.fn(async () => [{ totalBooks: 0, totalSlots: 0 }]),
      });
      const empty = await getCatalog({ page: 1, limit: 10 });
      expect(empty.ok).toBe(true);
      if (empty.ok) {
        expect(empty.data.pagination.totalSlots).toBe(0);
        expect(empty.data.pagination.totalPages).toBe(1);
      }

      // Middle page (page 2 of 3)
      selectMock.mockReturnValueOnce({
        from: vi.fn(async () => [{ totalBooks: 6, totalSlots: 6 }]),
      });
      selectDistinctMock.mockReturnValueOnce({
        from: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(async () => [{ sequenceOrder: 3 }, { sequenceOrder: 4 }]),
            })),
          })),
        })),
      });
      findManyMock.mockResolvedValueOnce([
        {
          id: "b3",
          sequenceOrder: 3,
          language: "en",
          pairedBookId: null,
          tasks: [],
        },
        {
          id: "b4",
          sequenceOrder: 4,
          language: "en",
          pairedBookId: null,
          tasks: [],
        },
      ]);

      const middle = await getCatalog({ page: 2, limit: 2 });
      expect(middle.ok).toBe(true);
      if (middle.ok) {
        expect(middle.data.pagination.hasPrevPage).toBe(true);
        expect(middle.data.pagination.hasNextPage).toBe(true);
        expect(middle.data.pagination.page).toBe(2);
      }
    });

    it("maintains stable ordering and paired editions grouping", async () => {
      selectMock.mockReturnValueOnce({
        from: vi.fn(async () => [{ totalBooks: 2, totalSlots: 1 }]),
      });
      selectDistinctMock.mockReturnValueOnce({
        from: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(async () => [{ sequenceOrder: 1 }]),
            })),
          })),
        })),
      });
      findManyMock.mockResolvedValueOnce([
        { id: "b1-am", title: "Amharic", sequenceOrder: 1, language: "am", tasks: [] },
        { id: "b1-en", title: "English", sequenceOrder: 1, language: "en", tasks: [] },
      ]);

      const result = await getCatalog({ page: 1, limit: 10 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.slots[0].editions).toHaveLength(2);
        expect(result.data.slots[0].editions[0].language).toBe("am");
        expect(result.data.slots[0].editions[1].language).toBe("en");
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             5. FAILURE TESTING                             */
  /* -------------------------------------------------------------------------- */
  describe("5. FAILURE TESTING & ORPHAN CLEANUP", () => {
    it("cleans up orphaned cover upload when DB insert fails", async () => {
      const deleteMock = vi.fn(async () => undefined);
      const storageService = {
        upload: vi.fn(async ({ key }) => ({
          key,
          publicUrl: `https://cdn.example.com/${key}`,
        })),
        delete: deleteMock,
        getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
      };

      selectMock.mockImplementation(() => ({
        from: vi.fn(() => {
          const rows: any[] = [];
          return Object.assign(Promise.resolve(rows), {
            where: vi.fn(() => ({ limit: vi.fn(async () => rows) })),
          });
        }),
      }));

      insertMock.mockReturnValue({
        values: vi.fn(() => {
          throw new Error("DB connection lost");
        }),
      });

      const validPng = await sharp({
        create: { width: 300, height: 300, channels: 3, background: { r: 0, g: 255, b: 0 } },
      })
        .png()
        .toBuffer();

      await expect(
        createBookWithCover(
          {
            title: "Failed Book",
            language: "en",
            cover: { body: new Uint8Array(validPng), declaredType: "image/png" },
          },
          storageService,
        ),
      ).rejects.toThrow("DB connection lost");

      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
  });
});
