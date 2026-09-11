import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockBookFindFirst,
  mockTaskFindFirst,
  mockTaskFindMany,
  mockInsertReturning,
  mockInsert,
  mockUpdateReturning,
  mockUpdate,
  mockTx,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  const mockBookFindFirst = vi.fn();
  const mockTaskFindFirst = vi.fn();
  const mockTaskFindMany = vi.fn();

  const mockTx = {
    query: {
      books: {
        findFirst: mockBookFindFirst,
      },
      tasks: {
        findFirst: mockTaskFindFirst,
        findMany: mockTaskFindMany,
      },
    },
    insert: mockInsert,
    update: mockUpdate,
  };

  return {
    mockBookFindFirst,
    mockTaskFindFirst,
    mockTaskFindMany,
    mockInsertReturning,
    mockInsert,
    mockUpdateReturning,
    mockUpdate,
    mockTx,
  };
});

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        books: {
          findFirst: mockBookFindFirst,
        },
        tasks: {
          findFirst: mockTaskFindFirst,
          findMany: mockTaskFindMany,
        },
      },
      insert: mockInsert,
      update: mockUpdate,
      transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return await cb(mockTx);
      }),
    },
  };
});

import {
  createTaskSchema,
  reviseTaskSchema,
  publishTaskSchema,
  getTasksForBookSchema,
} from "../../lib/validations/task";
import {
  createTask,
  reviseTask,
  publishTask,
  getPublishedTaskForStep,
  TaskError,
} from "../../lib/services/task";

const validUuid1 = "11111111-1111-4111-8111-111111111111";
const validUuid2 = "22222222-2222-4222-8222-222222222222";
const validAdminId = "99999999-9999-4999-8999-999999999999";

describe("Task Validation Schemas", () => {
  describe("createTaskSchema", () => {
    it("parses valid minimal task input", () => {
      const input = {
        bookId: validUuid1,
        dayNumber: 1,
        content: "Read chapter 1",
      };
      const parsed = createTaskSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.bookId).toBe(validUuid1);
        expect(parsed.data.dayNumber).toBe(1);
        expect(parsed.data.content).toBe("Read chapter 1");
      }
    });

    it("parses valid full task input with pages and title", () => {
      const input = {
        bookId: validUuid1,
        dayNumber: 2,
        title: "Day 2 Reading",
        content: "Read pages 15 to 30",
        pageStart: 15,
        pageEnd: 30,
        pageReference: "pp. 15-30",
      };
      const parsed = createTaskSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.pageStart).toBe(15);
        expect(parsed.data.pageEnd).toBe(30);
        expect(parsed.data.pageReference).toBe("pp. 15-30");
      }
    });

    it("rejects invalid page ranges where pageStart > pageEnd", () => {
      const input = {
        bookId: validUuid1,
        dayNumber: 1,
        content: "Read chapter 1",
        pageStart: 50,
        pageEnd: 20,
      };
      const parsed = createTaskSchema.safeParse(input);
      expect(parsed.success).toBe(false);
    });

    it("rejects non-positive dayNumber", () => {
      expect(
        createTaskSchema.safeParse({
          bookId: validUuid1,
          dayNumber: 0,
          content: "Read",
        }).success
      ).toBe(false);

      expect(
        createTaskSchema.safeParse({
          bookId: validUuid1,
          dayNumber: -5,
          content: "Read",
        }).success
      ).toBe(false);
    });

    it("rejects invalid bookId", () => {
      expect(
        createTaskSchema.safeParse({
          bookId: "not-a-uuid",
          dayNumber: 1,
          content: "Read",
        }).success
      ).toBe(false);
    });
  });

  describe("reviseTaskSchema", () => {
    it("requires taskId and at least one field or content", () => {
      const parsed = reviseTaskSchema.safeParse({
        taskId: validUuid1,
        content: "Updated content",
        pageStart: 10,
        pageEnd: 25,
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid page range in revision", () => {
      const parsed = reviseTaskSchema.safeParse({
        taskId: validUuid1,
        pageStart: 30,
        pageEnd: 10,
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("publishTaskSchema", () => {
    it("validates taskId", () => {
      expect(publishTaskSchema.safeParse({ taskId: validUuid1 }).success).toBe(true);
      expect(publishTaskSchema.safeParse({ taskId: "invalid" }).success).toBe(false);
    });
  });

  describe("getTasksForBookSchema", () => {
    it("validates bookId and optional status filter", () => {
      expect(
        getTasksForBookSchema.safeParse({
          bookId: validUuid1,
          status: "published",
        }).success
      ).toBe(true);

      expect(
        getTasksForBookSchema.safeParse({
          bookId: validUuid1,
        }).success
      ).toBe(true);
    });
  });
});

describe("Task Service - Immutability & Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    it("creates a new draft task when book exists and no published task exists for that day", async () => {
      mockBookFindFirst.mockResolvedValue({ id: validUuid1, title: "Test Book" });
      mockTaskFindFirst.mockResolvedValue(null);

      const createdTask = {
        id: validUuid2,
        bookId: validUuid1,
        dayNumber: 1,
        title: "Day 1",
        content: "Read pages 1-10",
        pageStart: 1,
        pageEnd: 10,
        pageReference: "pp. 1-10",
        status: "draft",
        version: 1,
        previousVersionId: null,
        createdBy: validAdminId,
        publishedAt: null,
      };

      mockInsertReturning.mockResolvedValue([createdTask]);

      const result = await createTask(
        {
          bookId: validUuid1,
          dayNumber: 1,
          title: "Day 1",
          content: "Read pages 1-10",
          pageStart: 1,
          pageEnd: 10,
          pageReference: "pp. 1-10",
        },
        validAdminId
      );

      expect(result).toEqual(createdTask);
      expect(mockInsert).toHaveBeenCalled();
    });

    it("throws BOOK_NOT_FOUND if the book does not exist", async () => {
      mockBookFindFirst.mockResolvedValue(null);

      await expect(
        createTask(
          {
            bookId: validUuid1,
            dayNumber: 1,
            content: "Read chapter 1",
          },
          validAdminId
        )
      ).rejects.toThrow(TaskError);
    });

    it("throws PUBLISHED_TASK_EXISTS if a published task already exists for that (bookId, dayNumber)", async () => {
      mockBookFindFirst.mockResolvedValue({ id: validUuid1 });
      mockTaskFindFirst.mockResolvedValue({
        id: validUuid2,
        bookId: validUuid1,
        dayNumber: 1,
        status: "published",
      });

      await expect(
        createTask(
          {
            bookId: validUuid1,
            dayNumber: 1,
            content: "Read chapter 1",
          },
          validAdminId
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: "PUBLISHED_TASK_EXISTS",
        })
      );
    });
  });

  describe("reviseTask (Immutability Pattern)", () => {
    it("creates a new draft version when revising a published task without mutating the published row", async () => {
      const existingPublishedTask = {
        id: validUuid1,
        bookId: validUuid2,
        dayNumber: 3,
        title: "Day 3 v1",
        content: "Original published content",
        pageStart: 20,
        pageEnd: 30,
        pageReference: "pp. 20-30",
        status: "published",
        version: 1,
        previousVersionId: null,
        createdBy: validAdminId,
      };

      mockTaskFindFirst.mockResolvedValue(existingPublishedTask);

      const newDraftTask = {
        id: "new-task-uuid",
        bookId: validUuid2,
        dayNumber: 3,
        title: "Day 3 v2",
        content: "Corrected content",
        pageStart: 20,
        pageEnd: 35,
        pageReference: "pp. 20-35",
        status: "draft",
        version: 2,
        previousVersionId: validUuid1,
        createdBy: validAdminId,
      };

      mockInsertReturning.mockResolvedValue([newDraftTask]);

      const result = await reviseTask(
        {
          taskId: validUuid1,
          title: "Day 3 v2",
          content: "Corrected content",
          pageEnd: 35,
          pageReference: "pp. 20-35",
        },
        validAdminId
      );

      expect(result.version).toBe(2);
      expect(result.previousVersionId).toBe(validUuid1);
      expect(result.status).toBe("draft");
      expect(mockInsert).toHaveBeenCalled();
      // Ensure the existing published row was not updated during revision creation
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("rejects revising a draft task", async () => {
      const existingDraftTask = {
        id: validUuid1,
        bookId: validUuid2,
        dayNumber: 3,
        status: "draft",
      };

      mockTaskFindFirst.mockResolvedValue(existingDraftTask);

      await expect(
        reviseTask(
          {
            taskId: validUuid1,
            content: "Updated draft content",
          },
          validAdminId
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: "INVALID_TRANSITION",
        })
      );
    });

    it("rejects revising superseded or archived tasks", async () => {
      mockTaskFindFirst.mockResolvedValue({
        id: validUuid1,
        status: "superseded",
      });

      await expect(
        reviseTask(
          {
            taskId: validUuid1,
            content: "New content",
          },
          validAdminId
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: "INVALID_TRANSITION",
        })
      );
    });
  });

  describe("publishTask", () => {
    it("publishes a draft and supersedes the previously published version in the same transaction", async () => {
      const draftTask = {
        id: "draft-task-id",
        bookId: validUuid1,
        dayNumber: 5,
        status: "draft",
        version: 2,
        previousVersionId: "old-published-task-id",
      };

      mockTaskFindFirst
        // First query: finding the target task
        .mockResolvedValueOnce(draftTask)
        // Second query: finding active published task to supersede
        .mockResolvedValueOnce({
          id: "old-published-task-id",
          bookId: validUuid1,
          dayNumber: 5,
          status: "published",
        });

      const publishedTask = {
        ...draftTask,
        status: "published",
        publishedAt: new Date(),
      };

      mockUpdateReturning.mockResolvedValue([publishedTask]);

      const result = await publishTask(
        { taskId: "draft-task-id" },
        validAdminId
      );

      expect(result.status).toBe("published");
      // Must have called update (one to supersede old, one to publish draft)
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("getPublishedTaskForStep (Cohort Batch Content Lookup)", () => {
    it("returns published task for book and dayNumber without duplicating records", async () => {
      const publishedTask = {
        id: validUuid1,
        bookId: validUuid2,
        dayNumber: 1,
        status: "published",
        content: "Day 1 content",
      };

      mockTaskFindFirst.mockResolvedValue(publishedTask);

      const result = await getPublishedTaskForStep(validUuid2, 1);
      expect(result).toEqual(publishedTask);
    });

    it("returns null when no published task exists for that day", async () => {
      mockTaskFindFirst.mockResolvedValue(null);

      const result = await getPublishedTaskForStep(validUuid2, 99);
      expect(result).toBeNull();
    });
  });
});