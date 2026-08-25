import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCatalog } from "../lib/services/get-catalog";
import { getCatalogAction } from "../actions/catalog";

const mocks = vi.hoisted(() => {
  const selectMock = vi.fn();
  const selectDistinctMock = vi.fn();
  const findManyMock = vi.fn();

  return { selectMock, selectDistinctMock, findManyMock };
});

const { selectMock, selectDistinctMock, findManyMock } = mocks;

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: {
    select: mocks.selectMock,
    selectDistinct: mocks.selectDistinctMock,
    query: {
      books: {
        findMany: mocks.findManyMock,
      },
    },
  },
}));

describe("getCatalog Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("handles empty catalog gracefully", async () => {
    selectMock.mockReturnValueOnce({
      from: vi.fn(async () => [{ totalBooks: 0, totalSlots: 0 }]),
    });

    const result = await getCatalog({ page: 1, limit: 10 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slots).toEqual([]);
      expect(result.data.books).toEqual([]);
      expect(result.data.pagination).toEqual({
        page: 1,
        limit: 10,
        totalSlots: 0,
        totalBooks: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    }
  });

  it("returns paginated slots with paired editions and tasks count", async () => {
    // 1. Stats query mock
    selectMock.mockReturnValueOnce({
      from: vi.fn(async () => [{ totalBooks: 3, totalSlots: 2 }]),
    });

    // 2. Distinct slots query mock
    selectDistinctMock.mockReturnValueOnce({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(async () => [{ sequenceOrder: 1 }, { sequenceOrder: 2 }]),
          })),
        })),
      })),
    });

    // 3. FindMany query mock
    const mockBook1En = {
      id: "b1-en",
      title: "Atomic Habits",
      language: "en",
      author: "James Clear",
      coverUrl: "covers/b1.webp",
      sequenceOrder: 1,
      pairedBookId: "b1-am",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      pairedBook: {
        id: "b1-am",
        title: "አቶሚክ ልማዶች",
        language: "am",
        author: "James Clear",
        coverUrl: "covers/b1-am.webp",
      },
      tasks: [{ id: "t1" }, { id: "t2" }],
    };

    const mockBook1Am = {
      id: "b1-am",
      title: "አቶሚክ ልማዶች",
      language: "am",
      author: "James Clear",
      coverUrl: "covers/b1-am.webp",
      sequenceOrder: 1,
      pairedBookId: "b1-en",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      pairedBook: {
        id: "b1-en",
        title: "Atomic Habits",
        language: "en",
        author: "James Clear",
        coverUrl: "covers/b1.webp",
      },
      tasks: [],
    };

    const mockBook2En = {
      id: "b2-en",
      title: "Deep Work",
      language: "en",
      author: "Cal Newport",
      coverUrl: null,
      sequenceOrder: 2,
      pairedBookId: null,
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
      pairedBook: null,
      tasks: [{ id: "t3" }],
    };

    findManyMock.mockResolvedValueOnce([mockBook1Am, mockBook1En, mockBook2En]);

    const result = await getCatalog({ page: 1, limit: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pagination).toEqual({
        page: 1,
        limit: 2,
        totalSlots: 2,
        totalBooks: 3,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      expect(result.data.slots).toHaveLength(2);
      expect(result.data.slots[0].slot).toBe(1);
      expect(result.data.slots[0].editions).toHaveLength(2);
      expect(result.data.slots[0].editions[0].title).toBe("አቶሚክ ልማዶች");
      expect(result.data.slots[0].editions[1].title).toBe("Atomic Habits");
      expect(result.data.slots[0].editions[1].tasksCount).toBe(2);

      expect(result.data.slots[1].slot).toBe(2);
      expect(result.data.slots[1].editions).toHaveLength(1);
      expect(result.data.slots[1].editions[0].title).toBe("Deep Work");
      expect(result.data.slots[1].editions[0].tasksCount).toBe(1);

      expect(result.data.books).toHaveLength(3);
    }
  });

  it("calculates hasNextPage and hasPrevPage correctly across multiple pages", async () => {
    selectMock.mockReturnValueOnce({
      from: vi.fn(async () => [{ totalBooks: 5, totalSlots: 5 }]),
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
        title: "Book 3",
        language: "en",
        author: null,
        coverUrl: null,
        sequenceOrder: 3,
        pairedBookId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        pairedBook: null,
        tasks: [],
      },
      {
        id: "b4",
        title: "Book 4",
        language: "en",
        author: null,
        coverUrl: null,
        sequenceOrder: 4,
        pairedBookId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        pairedBook: null,
        tasks: [],
      },
    ]);

    const result = await getCatalog({ page: 2, limit: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pagination).toEqual({
        page: 2,
        limit: 2,
        totalSlots: 5,
        totalBooks: 5,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    }
  });
});

describe("getCatalogAction Server Action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("delegates to getCatalog cleanly", async () => {
    selectMock.mockReturnValueOnce({
      from: vi.fn(async () => [{ totalBooks: 0, totalSlots: 0 }]),
    });

    const result = await getCatalogAction({ page: 1, limit: 10 });
    expect(result.ok).toBe(true);
  });
});
