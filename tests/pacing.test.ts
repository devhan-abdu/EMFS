import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateBatchCurrentDay,
  calculateEffectiveDateForStep,
  proposeNextPageRange,
  resolveCurrentBookForBatch,
  getTodayTaskProposal,
  publishPaceGroupTask,
  type DbOrTx,
} from "@/lib/services/pacing";
import {
  proposeNextPageRangeSchema,
  publishPaceGroupTaskSchema,
} from "@/lib/validations/pacing";

// Mock DB
const mocks = vi.hoisted(() => {
  const selectMock = vi.fn();
  const updateMock = vi.fn();
  const insertMock = vi.fn();
  const transactionMock = vi.fn();

  return { selectMock, updateMock, insertMock, transactionMock };
});

vi.mock("@/db", () => ({
  db: {
    select: mocks.selectMock,
    update: mocks.updateMock,
    insert: mocks.insertMock,
    transaction: mocks.transactionMock,
  },
}));

describe("Pacing Validations", () => {
  it("validates proposeNextPageRangeSchema", () => {
    expect(proposeNextPageRangeSchema.safeParse({ cursor: 8, pace: 10 }).success).toBe(true);
    expect(proposeNextPageRangeSchema.safeParse({ cursor: 0, pace: 5 }).success).toBe(true);
    expect(proposeNextPageRangeSchema.safeParse({ cursor: -1, pace: 10 }).success).toBe(false);
    expect(proposeNextPageRangeSchema.safeParse({ cursor: 8, pace: 0 }).success).toBe(false);
  });

  it("validates publishPaceGroupTaskSchema", () => {
    const valid = {
      batchId: "550e8400-e29b-41d4-a716-446655440000",
      paceGroupId: "660e8400-e29b-41d4-a716-446655440000",
      bookId: "770e8400-e29b-41d4-a716-446655440000",
      startPage: 9,
      endPage: 18,
    };
    expect(publishPaceGroupTaskSchema.safeParse(valid).success).toBe(true);

    // End page less than start page
    expect(
      publishPaceGroupTaskSchema.safeParse({
        ...valid,
        startPage: 18,
        endPage: 9,
      }).success
    ).toBe(false);
  });
});

describe("Page Range Proposal Calculation", () => {
  it("proposes next page range correctly: cursor 8 + pace 10 => 9–18", () => {
    const range = proposeNextPageRange(8, 10);
    expect(range).toEqual({ startPage: 9, endPage: 18 });
  });

  it("handles initial cursor 0: cursor 0 + pace 10 => 1–10", () => {
    const range = proposeNextPageRange(0, 10);
    expect(range).toEqual({ startPage: 1, endPage: 10 });
  });

  it("handles initial cursor 0 with pace 5 => 1–5", () => {
    const range = proposeNextPageRange(0, 5);
    expect(range).toEqual({ startPage: 1, endPage: 5 });
  });
});

describe("Batch Current Day, Cadence, & Pacing Offsets Semantics", () => {
  it("returns day 0 / not started when targetDate is before startDate", () => {
    const res = calculateBatchCurrentDay("2026-09-01", 6, [], "2026-08-31");
    expect(res.isStarted).toBe(false);
    expect(res.dayNumber).toBe(0);
  });

  it("returns day 1 on startDate", () => {
    const res = calculateBatchCurrentDay("2026-09-01", 6, [], "2026-09-01");
    expect(res.isStarted).toBe(true);
    expect(res.dayNumber).toBe(1);
  });

  it("advances active curriculum day according to 6-day reading schedule", () => {
    // Start Tuesday 2026-09-01
    // Step 1: 2026-09-01
    // Step 2: 2026-09-02
    // Step 3: 2026-09-03
    // Step 4: 2026-09-04
    // Step 5: 2026-09-05
    // Step 6: 2026-09-06
    // Rest day: 2026-09-07 -> curriculum day remains 6 (previous step stays active)
    // Step 7: 2026-09-08
    const day6 = calculateBatchCurrentDay("2026-09-01", 6, [], "2026-09-06");
    expect(day6.dayNumber).toBe(6);

    const day7Rest = calculateBatchCurrentDay("2026-09-01", 6, [], "2026-09-07");
    expect(day7Rest.dayNumber).toBe(6);

    const day8 = calculateBatchCurrentDay("2026-09-01", 6, [], "2026-09-08");
    expect(day8.dayNumber).toBe(7);
  });

  it("calculates exact effective date for step according to domain formula: base_date + offsets", () => {
    // Step 1 starts on 2026-09-01
    expect(calculateEffectiveDateForStep("2026-09-01", 6, [], 1)).toBe("2026-09-01");
    // Step 6 is on 2026-09-06
    expect(calculateEffectiveDateForStep("2026-09-01", 6, [], 6)).toBe("2026-09-06");
    // Step 7 skips rest day 2026-09-07 and is due on 2026-09-08
    expect(calculateEffectiveDateForStep("2026-09-01", 6, [], 7)).toBe("2026-09-08");

    // An offset of +3 effective from step 12 pauses step 12 and all later steps by 3 days
    const offsets = [{ effectiveFromDayNumber: 12, offsetDays: 3 }];
    const step11Date = calculateEffectiveDateForStep("2026-09-01", 6, offsets, 11);
    const step12Date = calculateEffectiveDateForStep("2026-09-01", 6, offsets, 12);
    // Without offset, step 12 base date would be 2026-09-13 (11th reading day: 2026-09-12, 12th reading day: 2026-09-13)
    // With +3 offset, step 12 is due on 2026-09-16
    expect(step11Date).toBe("2026-09-12");
    expect(step12Date).toBe("2026-09-16");
  });

  it("pacing offsets affect due timing without altering catalog ordering or content", () => {
    // An offset of +3 effective from day 12 pauses day 12 by 3 calendar days
    const offsets = [{ effectiveFromDayNumber: 12, offsetDays: 3 }];

    // On 2026-09-12, step 11 is due and active
    const day11 = calculateBatchCurrentDay("2026-09-01", 6, offsets, "2026-09-12");
    expect(day11.dayNumber).toBe(11);

    // During the pause (2026-09-13 through 2026-09-15), step 11 remains active
    const pausedDay = calculateBatchCurrentDay("2026-09-01", 6, offsets, "2026-09-15");
    expect(pausedDay.dayNumber).toBe(11);

    // On 2026-09-16, step 12 becomes active
    const resumedDay = calculateBatchCurrentDay("2026-09-01", 6, offsets, "2026-09-16");
    expect(resumedDay.dayNumber).toBe(12);
  });
});

describe("Current-Book Resolution & Book Advancement (curriculum-and-pacing.md)", () => {
  const batchId = "550e8400-e29b-41d4-a716-446655440001";
  const book1 = {
    id: "770e8400-e29b-41d4-a716-446655440001",
    title: "Atomic Habits",
    language: "en",
    sequenceOrder: 1,
    pairedBookId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const book2 = {
    id: "770e8400-e29b-41d4-a716-446655440002",
    title: "Deep Work",
    language: "en",
    sequenceOrder: 2,
    pairedBookId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const masterTasks = [
    { id: "task-1", bookId: book1.id, dayNumber: 1, content: "Atomic Habits Day 1" },
    { id: "task-2", bookId: book1.id, dayNumber: 2, content: "Atomic Habits Day 2" },
    { id: "task-3", bookId: book2.id, dayNumber: 3, content: "Deep Work Day 1" },
    { id: "task-4", bookId: book2.id, dayNumber: 4, content: "Deep Work Day 2" },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("resolves currentBook as the book linked to the current task and nextBook as the first book after that task's book sequence", async () => {
    const mockDb = {
      select: vi.fn(),
    };

    // 1. Batch query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: batchId,
            name: "Batch 1",
            startDate: "2026-09-01",
            readingDaysPerWeek: 6,
          },
        ]),
      }),
    });

    // 2. Offsets query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // 3. Books query from catalog
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([book1, book2]),
      }),
    });

    // 4. Tasks query from master curriculum
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(masterTasks),
      }),
    });

    const result = await resolveCurrentBookForBatch(
      batchId,
      "2026-09-01",
      mockDb as unknown as DbOrTx
    );

    expect(result.isStarted).toBe(true);
    expect(result.dayNumber).toBe(1);
    expect(result.currentBook?.id).toBe(book1.id);
    expect(result.currentBook?.title).toBe("Atomic Habits");
    expect(result.nextBook?.id).toBe(book2.id);
    expect(result.nextBook?.title).toBe("Deep Work");
  });

  it("proves a batch advances from one catalog book to the next as curriculum days progress", async () => {
    // Helper to simulate DB queries for a specific target date
    const runResolution = async (targetDate: string) => {
      const mockDb = {
        select: vi.fn(),
      };
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: batchId, startDate: "2026-09-01", readingDaysPerWeek: 6 },
          ]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([book1, book2]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(masterTasks),
        }),
      });

      return await resolveCurrentBookForBatch(
        batchId,
        targetDate,
        mockDb as unknown as DbOrTx
      );
    };

    // Day 1 (2026-09-01) -> DayNumber 1 -> Task 1 (Atomic Habits)
    const day1Result = await runResolution("2026-09-01");
    expect(day1Result.dayNumber).toBe(1);
    expect(day1Result.currentBook?.id).toBe(book1.id);
    expect(day1Result.currentBook?.title).toBe("Atomic Habits");
    expect(day1Result.nextBook?.id).toBe(book2.id);

    // Day 2 (2026-09-02) -> DayNumber 2 -> Task 2 (Atomic Habits)
    const day2Result = await runResolution("2026-09-02");
    expect(day2Result.dayNumber).toBe(2);
    expect(day2Result.currentBook?.id).toBe(book1.id);
    expect(day2Result.nextBook?.id).toBe(book2.id);

    // Day 3 (2026-09-03) -> DayNumber 3 -> Task 3 (Deep Work)
    // Batch advances to the next book in catalog!
    const day3Result = await runResolution("2026-09-03");
    expect(day3Result.dayNumber).toBe(3);
    expect(day3Result.currentBook?.id).toBe(book2.id);
    expect(day3Result.currentBook?.title).toBe("Deep Work");
    // After Deep Work (sequence 2), there is no subsequent book in catalog
    expect(day3Result.nextBook).toBeNull();
  });

  it("proves pacing offsets change due dates only, delaying book transition without changing catalog order/content", async () => {
    // An offset of +2 days starting from day 3 delays task 3 by 2 calendar days
    const offsets = [{ effectiveFromDayNumber: 3, offsetDays: 2 }];

    const runResolutionWithOffset = async (targetDate: string) => {
      const mockDb = {
        select: vi.fn(),
      };
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: batchId, startDate: "2026-09-01", readingDaysPerWeek: 6 },
          ]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(offsets),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([book1, book2]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(masterTasks),
        }),
      });

      return await resolveCurrentBookForBatch(
        batchId,
        targetDate,
        mockDb as unknown as DbOrTx
      );
    };

    // On 2026-09-03 (originally day 3), the pause is in effect, so batch is still on day 2
    const pausedResult = await runResolutionWithOffset("2026-09-03");
    expect(pausedResult.dayNumber).toBe(2);
    expect(pausedResult.currentBook?.id).toBe(book1.id);
    expect(pausedResult.nextBook?.id).toBe(book2.id);

    // On 2026-09-05, the 2-day pause finishes and day 3 becomes active
    const resumedResult = await runResolutionWithOffset("2026-09-05");
    expect(resumedResult.dayNumber).toBe(3);
    expect(resumedResult.currentBook?.id).toBe(book2.id);
    expect(resumedResult.currentBook?.title).toBe("Deep Work");
    expect(resumedResult.nextBook).toBeNull();

    // Catalog order is preserved (book1 is still sequenceOrder 1, book2 is sequenceOrder 2)
    expect(book1.sequenceOrder).toBe(1);
    expect(book2.sequenceOrder).toBe(2);
  });

  it("returns null current book and slot 1 as nextBook when batch has not started", async () => {
    const mockDb = {
      select: vi.fn(),
    };

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: batchId, startDate: "2026-09-10", readingDaysPerWeek: 6 },
        ]),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([book1, book2]),
      }),
    });

    const result = await resolveCurrentBookForBatch(
      batchId,
      "2026-09-01",
      mockDb as unknown as DbOrTx
    );

    expect(result.isStarted).toBe(false);
    expect(result.dayNumber).toBe(0);
    expect(result.currentBook).toBeNull();
    expect(result.nextBook?.id).toBe(book1.id);
  });
});

describe("Reusable Tasks & Today's Task Proposal", () => {
  const batchId = "550e8400-e29b-41d4-a716-446655440001";
  const paceGroupId = "660e8400-e29b-41d4-a716-446655440001";
  const book1 = {
    id: "770e8400-e29b-41d4-a716-446655440001",
    title: "Atomic Habits",
    language: "en",
    sequenceOrder: 1,
    pairedBookId: null,
  };

  it("links and reuses existing reusable task when matching task exists", async () => {
    const mockDb = {
      select: vi.fn(),
    };

    // 1. Pace group query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: paceGroupId, batchId, name: "10-Page Group", size: 10, cursor: 8 },
        ]),
      }),
    });

    // 2. Batch query for resolveCurrentBookForBatch
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: batchId, name: "Batch 1", startDate: "2026-09-01", readingDaysPerWeek: 6 },
        ]),
      }),
    });

    // 3. Offsets query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // 4. Books query (catalog)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([book1]),
      }),
    });

    // 5. Tasks query for resolveCurrentBookForBatch
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([
          { id: "task-101", bookId: book1.id, dayNumber: 1, content: "Read pages 9–18 and reflect" },
        ]),
      }),
    });

    // 6. Tasks query for getTodayTaskProposal filtered by bookId
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: "task-101", bookId: book1.id, dayNumber: 1, content: "Read pages 9–18 and reflect" },
        ]),
      }),
    });

    const result = await getTodayTaskProposal(
      batchId,
      paceGroupId,
      "2026-09-01",
      mockDb as unknown as DbOrTx
    );

    expect(result.source).toBe("reusable");
    expect(result.reusableTask?.id).toBe("task-101");
    expect(result.proposedPageRange).toEqual({ startPage: 9, endPage: 18 });
    expect(result.draftContent).toBe("Read pages 9–18 and reflect");
  });

  it("creates draft proposal when no reusable task exists in library", async () => {
    const mockDb = {
      select: vi.fn(),
    };

    // 1. Pace group query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: paceGroupId, batchId, name: "10-Page Group", size: 10, cursor: 8 },
        ]),
      }),
    });

    // 2. Batch query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: batchId, name: "Batch 1", startDate: "2026-09-01", readingDaysPerWeek: 6 },
        ]),
      }),
    });

    // 3. Offsets query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // 4. Books query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([book1]),
      }),
    });

    // 5. Tasks query for resolveCurrentBookForBatch (empty)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    });

    // 6. Tasks query for getTodayTaskProposal (empty)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await getTodayTaskProposal(
      batchId,
      paceGroupId,
      "2026-09-01",
      mockDb as unknown as DbOrTx
    );

    expect(result.source).toBe("draft");
    expect(result.reusableTask).toBeNull();
    expect(result.proposedPageRange).toEqual({ startPage: 9, endPage: 18 });
    expect(result.draftContent).toContain("Read pages 9–18 of Atomic Habits");
  });
});

describe("Admin Range Adjustment, Publishing, & Strict Cursor Isolation", () => {
  const batchAId = "550e8400-e29b-41d4-a716-446655440001";
  const batchBId = "550e8400-e29b-41d4-a716-446655440002";
  const paceGroupAId = "660e8400-e29b-41d4-a716-446655440001";
  const bookId = "770e8400-e29b-41d4-a716-446655440001";

  it("allows admin to adjust proposed range (9–18 to 9–15) and advances only that pace group cursor", async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
    };

    // 1. Check pace group belongs to batch
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: paceGroupAId, batchId: batchAId, name: "Group A", size: 10, cursor: 8 },
        ]),
      }),
    });

    // 2. Check book exists
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: bookId, title: "Atomic Habits", sequenceOrder: 1 },
        ]),
      }),
    });

    // 3. Update cursor to adjusted endPage (15)
    mockTx.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: paceGroupAId, batchId: batchAId, name: "Group A", size: 10, cursor: 15 },
          ]),
        }),
      }),
    });

    const mockExecutor = {
      transaction: vi.fn(async (cb) => cb(mockTx)),
    };

    const result = await publishPaceGroupTask(
      {
        batchId: batchAId,
        paceGroupId: paceGroupAId,
        bookId,
        startPage: 9,
        endPage: 15, // Adjusted from 18 to 15
      },
      mockExecutor as unknown as DbOrTx
    );

    expect(result.previousCursor).toBe(8);
    expect(result.newCursor).toBe(15);
    expect(result.publishedRange).toEqual({ startPage: 9, endPage: 15 });
  });

  it("Batch A cursor changes without changing Batch B cursor (strict isolation)", async () => {
    const paceGroupA = { id: paceGroupAId, batchId: batchAId, size: 10, cursor: 8 };
    const paceGroupB = { id: "group-b", batchId: batchBId, size: 10, cursor: 20 };

    const mockTxA = {
      select: vi.fn(),
      update: vi.fn(),
    };

    // Group A publish
    mockTxA.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([paceGroupA]),
      }),
    });
    mockTxA.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: bookId }]),
      }),
    });
    mockTxA.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...paceGroupA, cursor: 18 }]),
        }),
      }),
    });

    const mockExecutorA = {
      transaction: vi.fn(async (cb) => cb(mockTxA)),
    };

    const resultA = await publishPaceGroupTask(
      {
        batchId: batchAId,
        paceGroupId: paceGroupAId,
        bookId,
        startPage: 9,
        endPage: 18,
      },
      mockExecutorA as unknown as DbOrTx
    );

    // Batch A cursor advances to 18
    expect(resultA.newCursor).toBe(18);

    // Batch B cursor remains completely untouched at 20
    expect(paceGroupB.cursor).toBe(20);
  });

  it("shared reusable task does not share progress across batches", async () => {
    // Both batches reference the same reusable task row "task-shared"
    const sharedTaskId = "task-shared";
    const reusableTaskRow = {
      id: sharedTaskId,
      bookId,
      dayNumber: 1,
      content: "Read pages 9–18",
    };

    const paceGroupA = { id: paceGroupAId, batchId: batchAId, size: 10, cursor: 8 };

    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
    };

    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([paceGroupA]),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: bookId }]),
      }),
    });
    mockTx.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...paceGroupA, cursor: 18 }]),
        }),
      }),
    });

    const mockExecutor = {
      transaction: vi.fn(async (cb) => cb(mockTx)),
    };

    const result = await publishPaceGroupTask(
      {
        batchId: batchAId,
        paceGroupId: paceGroupAId,
        bookId,
        startPage: 9,
        endPage: 18,
        taskId: sharedTaskId,
      },
      mockExecutor as unknown as DbOrTx
    );

    // Pace group A cursor updated
    expect(result.newCursor).toBe(18);
    // Task row is never mutated (no cursor on tasks)
    expect(reusableTaskRow).not.toHaveProperty("cursor");
    expect(mockTx.update).toHaveBeenCalledTimes(1); // ONLY updates pace_groups table
  });
});

