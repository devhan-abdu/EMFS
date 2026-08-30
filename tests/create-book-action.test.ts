import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBookAction } from "../actions/catalog";
import * as createBookModule from "../lib/services/create-book";
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

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: {},
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
vi.mock("../lib/services/create-book", () => ({
  createBookWithCover: vi.fn(),
  addPairedEditionWithCover: vi.fn(),
}));
vi.mock("../lib/services/reorder-catalog", () => ({
  reorderCatalogSlots: vi.fn(),
}));
vi.mock("../lib/services/get-catalog", () => ({
  getCatalog: vi.fn(),
}));
vi.mock("../lib/services/storage/get-storage-service", () => ({
  getStorageService: vi.fn(),
}));


describe("createBookAction", () => {
  const mockStorageService: StorageService = {
    upload: vi.fn(),
    delete: vi.fn(),
    getPublicUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(storageFactoryModule.getStorageService).mockReturnValue(mockStorageService);
  });

  it("rejects unauthenticated caller with UNAUTHENTICATED error", async () => {
    mockRequireSuperAdmin.mockRejectedValue(
      new AuthzErrorMock("UNAUTHENTICATED", "You must be signed in."),
    );

    const result = await createBookAction({
      title: "Test Book",
      language: "en",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        {
          field: "auth",
          code: "UNAUTHENTICATED",
          message: "You must be signed in.",
        },
      ]);
    }
  });

  it("rejects non-super-admin roles with FORBIDDEN error", async () => {
    mockRequireSuperAdmin.mockRejectedValue(
      new AuthzErrorMock(
        "FORBIDDEN",
        "Role 'batch_admin' is not permitted. Required at least: super_admin.",
      ),
    );

    const result = await createBookAction({
      title: "Test Book",
      language: "en",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        {
          field: "auth",
          code: "FORBIDDEN",
          message: "Role 'batch_admin' is not permitted. Required at least: super_admin.",
        },
      ]);
    }
  });

  it("successfully creates a book for super_admin with object input", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      authUserId: "user-1",
      email: "admin@example.com",
      profile: {
        id: "prof-1",
        authUserId: "user-1",
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

    vi.mocked(createBookModule.createBookWithCover).mockResolvedValue({
      ok: true,
      data: {
        id: "book-123",
        title: "Clean Architecture",
        language: "en",
        author: "Robert C. Martin",
        coverUrl: "covers/test-uuid.webp",
        sequenceOrder: 1,
        pairedBookId: null,
      },
    });

    const result = await createBookAction({
      title: "Clean Architecture",
      language: "en",
      author: "Robert C. Martin",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("book-123");
      expect(result.data.title).toBe("Clean Architecture");
      expect(result.data.sequenceOrder).toBe(1);
    }
    expect(createBookModule.createBookWithCover).toHaveBeenCalledWith(
      {
        title: "Clean Architecture",
        language: "en",
        author: "Robert C. Martin",
        cover: undefined,
      },
      mockStorageService,
    );
  });

  it("handles FormData input with file upload correctly", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      authUserId: "user-1",
      email: "admin@example.com",
      profile: {
        id: "prof-1",
        authUserId: "user-1",
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

    vi.mocked(createBookModule.createBookWithCover).mockResolvedValue({
      ok: true,
      data: {
        id: "book-456",
        title: "Atomic Habits",
        language: "am",
        author: "James Clear",
        coverUrl: "covers/habits.webp",
        sequenceOrder: 2,
        pairedBookId: null,
      },
    });

    const formData = new FormData();
    formData.append("title", "Atomic Habits");
    formData.append("language", "am");
    formData.append("author", "James Clear");
    const fakeFile = new File([new Uint8Array([1, 2, 3])], "cover.png", {
      type: "image/png",
    });
    formData.append("cover", fakeFile);

    const result = await createBookAction(formData);

    expect(result.ok).toBe(true);
    expect(createBookModule.createBookWithCover).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Atomic Habits",
        language: "am",
        author: "James Clear",
        cover: expect.objectContaining({
          declaredType: "image/png",
        }),
      }),
      mockStorageService,
    );
  });

  it("returns validation errors from service layer if validation fails", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      authUserId: "user-1",
      email: "admin@example.com",
      profile: {
        id: "prof-1",
        authUserId: "user-1",
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

    vi.mocked(createBookModule.createBookWithCover).mockResolvedValue({
      ok: false,
      errors: [
        {
          field: "language",
          code: "invalid_string",
          message: "language must be a 2–5 letter lowercase code (e.g. en, am)",
        },
      ],
    });

    const result = await createBookAction({
      title: "Test Book",
      language: "ENGLISH",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("language");
      expect(result.errors[0].code).toBe("invalid_string");
    }
  });
});
