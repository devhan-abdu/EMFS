import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  batches,
  batchPacingOffsets,
  books,
  tasks,
  paceGroups,
  type Book,
  type Task,
  type PaceGroup,
} from "@/db/schema";
import type { PublishPaceGroupTaskInput } from "@/lib/validations/pacing";

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = DbClient | DbTransaction;

export type PacingErrorCode =
  | "BATCH_NOT_FOUND"
  | "PACE_GROUP_NOT_FOUND"
  | "PACE_GROUP_BATCH_MISMATCH"
  | "BOOK_NOT_FOUND"
  | "INVALID_PAGE_RANGE"
  | "UNAUTHORIZED"
  | "CATALOG_EMPTY"
  | "TRANSACTION_FAILED";

export class PacingError extends Error {
  code: PacingErrorCode;
  constructor(code: PacingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PacingError";
  }
}

export type ProposedPageRange = {
  startPage: number;
  endPage: number;
};

export type CurrentBookResolutionResult = {
  batchId: string;
  targetDate: string; // YYYY-MM-DD
  dayNumber: number; // 0 if not started, else >= 1
  isStarted: boolean;
  currentBook: Book | null;
  nextBook: Book | null;
  effectiveCadenceDay: number;
};

export type TodayTaskProposalResult = {
  batchId: string;
  paceGroupId: string;
  paceGroupName: string;
  pace: number;
  cursor: number;
  proposedPageRange: ProposedPageRange;
  currentBook: Book | null;
  nextBook: Book | null;
  dayNumber: number;
  isStarted: boolean;
  source: "reusable" | "draft";
  reusableTask: Task | null;
  draftContent: string;
};

export type PublishPaceGroupTaskResult = {
  paceGroup: PaceGroup;
  previousCursor: number;
  newCursor: number;
  publishedRange: ProposedPageRange;
  bookId: string;
  taskId?: string | null;
};

/**
 * Calculates the effective calendar date (YYYY-MM-DD) for a given curriculum step n.
 *
 * Domain semantics (curriculum-and-pacing.md):
 * base_date(B, 1) = B.start_date
 * base_date(B, n) = the nth date selected by B's recurring cadence
 *
 * effective_date(B, n) = base_date(B, n)
 *                      + sum(offset_days for B's offsets effective at or before n)
 */
export function calculateEffectiveDateForStep(
  startDateStr: string,
  readingDaysPerWeek: number = 6,
  offsets: Array<{ effectiveFromDayNumber: number; offsetDays: number }> = [],
  step: number = 1
): string {
  if (step < 1) {
    throw new Error("Curriculum step must be >= 1");
  }

  const [year, month, day] = startDateStr.slice(0, 10).split("-").map(Number);
  const startUtc = new Date(Date.UTC(year, month - 1, day));

  // Calendar day offset from start date for the nth reading day
  // Each 7-day cycle contains readingDaysPerWeek scheduled days
  const cycles = Math.floor((step - 1) / readingDaysPerWeek);
  const remainder = (step - 1) % readingDaysPerWeek;
  const baseCalendarDays = cycles * 7 + remainder;

  // Sum of offsets effective at or before step n
  const offsetDaysSum = offsets
    .filter((o) => o.effectiveFromDayNumber <= step)
    .reduce((sum, o) => sum + o.offsetDays, 0);

  const totalCalendarDays = baseCalendarDays + offsetDaysSum;
  const effectiveUtc = new Date(startUtc.getTime() + totalCalendarDays * 86400000);
  return effectiveUtc.toISOString().slice(0, 10);
}

/**
 * Calculates the active curriculum day number for a batch on a target calendar date.
 *
 * Domain semantics:
 * current task = highest task day_number n where effective_date(B, n) <= D
 * next task    = lowest task day_number n where effective_date(B, n) > D
 *
 * If targetDate < effective_date(B, 1), batch has not started (dayNumber: 0).
 */
export function calculateBatchCurrentDay(
  startDateStr: string | null,
  readingDaysPerWeek: number = 6,
  offsets: Array<{ effectiveFromDayNumber: number; offsetDays: number }> = [],
  targetDateInput: Date | string = new Date()
): { dayNumber: number; isStarted: boolean; targetDateStr: string } {
  const targetDateStr =
    typeof targetDateInput === "string"
      ? targetDateInput.slice(0, 10)
      : targetDateInput.toISOString().slice(0, 10);

  if (!startDateStr) {
    return { dayNumber: 0, isStarted: false, targetDateStr };
  }

  const startDateFormatted = startDateStr.slice(0, 10);

  // Before batch start date
  const step1EffectiveDate = calculateEffectiveDateForStep(
    startDateFormatted,
    readingDaysPerWeek,
    offsets,
    1
  );

  if (targetDateStr < step1EffectiveDate) {
    return { dayNumber: 0, isStarted: false, targetDateStr };
  }

  // Find the highest step n where effective_date(B, n) <= targetDate
  let activeStep = 1;
  while (true) {
    const nextStepEffectiveDate = calculateEffectiveDateForStep(
      startDateFormatted,
      readingDaysPerWeek,
      offsets,
      activeStep + 1
    );
    if (nextStepEffectiveDate <= targetDateStr) {
      activeStep++;
    } else {
      break;
    }
  }

  return {
    dayNumber: activeStep,
    isStarted: true,
    targetDateStr,
  };
}

/**
 * Resolves the current book and curriculum state for a batch deterministically.
 *
 * Domain semantics (curriculum-and-pacing.md):
 * 1. Active curriculum day/step is computed from batch start_date, cadence, and offsets.
 * 2. currentTask = highest task day_number n where effective_date(B, n) <= D.
 * 3. currentBook is the book linked to currentTask.
 * 4. nextBook is the first book in catalog after currentBook.sequence_order.
 *    Before a batch begins, currentBook is null and nextBook is the first book in the library (slot 1).
 * 5. Pacing offsets change due dates only, never catalog order or content.
 */
export async function resolveCurrentBookForBatch(
  batchId: string,
  targetDateInput?: Date | string,
  executor: DbOrTx = db
): Promise<CurrentBookResolutionResult> {
  const [batch] = await executor
    .select()
    .from(batches)
    .where(eq(batches.id, batchId));

  if (!batch) {
    throw new PacingError("BATCH_NOT_FOUND", `Batch with id '${batchId}' not found.`);
  }

  const offsets = await executor
    .select()
    .from(batchPacingOffsets)
    .where(eq(batchPacingOffsets.batchId, batchId))
    .orderBy(asc(batchPacingOffsets.effectiveFromDayNumber));

  const calculation = calculateBatchCurrentDay(
    batch.startDate,
    batch.readingDaysPerWeek,
    offsets.map((o) => ({
      effectiveFromDayNumber: o.effectiveFromDayNumber,
      offsetDays: o.offsetDays,
    })),
    targetDateInput
  );

  // Fetch all books ordered by sequenceOrder ASC, language ASC, id ASC
  const allBooks = await executor
    .select()
    .from(books)
    .orderBy(asc(books.sequenceOrder), asc(books.language), asc(books.id));

  if (allBooks.length === 0) {
    return {
      batchId: batch.id,
      targetDate: calculation.targetDateStr,
      dayNumber: calculation.dayNumber,
      isStarted: calculation.isStarted,
      currentBook: null,
      nextBook: null,
      effectiveCadenceDay: calculation.dayNumber,
    };
  }

  // Get distinct slot sequence numbers in order
  const distinctSlots = Array.from(
    new Set(allBooks.map((b) => b.sequenceOrder))
  ).sort((a, b) => a - b);

  const firstSlot = distinctSlots[0];

  if (!calculation.isStarted) {
    // Before batch start: no current book, nextBook is slot 1
    const nextBook = allBooks.find((b) => b.sequenceOrder === firstSlot) ?? null;
    return {
      batchId: batch.id,
      targetDate: calculation.targetDateStr,
      dayNumber: 0,
      isStarted: false,
      currentBook: null,
      nextBook,
      effectiveCadenceDay: 0,
    };
  }

  // Fetch tasks in master curriculum ordered by dayNumber
  const allTasks = await executor
    .select()
    .from(tasks)
    .orderBy(asc(tasks.dayNumber));

  // currentTask is the highest task day_number n where day_number <= calculation.dayNumber
  const eligibleTasks = allTasks.filter((t) => t.dayNumber <= calculation.dayNumber);
  const currentTask =
    eligibleTasks.length > 0
      ? eligibleTasks[eligibleTasks.length - 1]
      : null;

  let currentBook: Book | null = null;
  let nextBook: Book | null = null;

  if (currentTask) {
    // currentBook is the book linked to currentTask
    currentBook = allBooks.find((b) => b.id === currentTask.bookId) ?? null;
  } else if (allTasks.length === 0) {
    // Fallback if tasks library is empty: start at slot 1
    currentBook = allBooks.find((b) => b.sequenceOrder === firstSlot) ?? null;
  }

  if (currentBook) {
    // nextBook is the first book in catalog after currentBook.sequence_order
    const nextSlot = distinctSlots.find((s) => s > currentBook!.sequenceOrder);
    if (nextSlot !== undefined) {
      nextBook = allBooks.find((b) => b.sequenceOrder === nextSlot) ?? null;
    }
  } else {
    nextBook = allBooks.find((b) => b.sequenceOrder === firstSlot) ?? null;
  }

  return {
    batchId: batch.id,
    targetDate: calculation.targetDateStr,
    dayNumber: calculation.dayNumber,
    isStarted: true,
    currentBook,
    nextBook,
    effectiveCadenceDay: calculation.dayNumber,
  };
}

/**
 * Calculates the next proposed page range based on a pace group's cursor and pace.
 *
 * Example:
 * cursor = 8, pace = 10 => { startPage: 9, endPage: 18 }
 * cursor = 0, pace = 10 => { startPage: 1, endPage: 10 }
 */
export function proposeNextPageRange(
  cursor: number,
  pace: number
): ProposedPageRange {
  const startPage = cursor + 1;
  const endPage = cursor + pace;
  return { startPage, endPage };
}

/**
 * Looks up today's task proposal for a pace group:
 * 1. Resolves current book and curriculum state for the batch (independent of tasks library).
 * 2. Gets the pace group's saved cursor and pace.
 * 3. Proposes the next page range (cursor 8 + pace 10 -> 9–18).
 * 4. THEN searches `tasks` library for an appropriate reusable task matching the book.
 * 5. If match found -> returns reusable task.
 * 6. If no match -> returns draft proposal.
 */
export async function getTodayTaskProposal(
  batchId: string,
  paceGroupId: string,
  targetDateInput?: Date | string,
  executor: DbOrTx = db
): Promise<TodayTaskProposalResult> {
  const [paceGroup] = await executor
    .select()
    .from(paceGroups)
    .where(and(eq(paceGroups.id, paceGroupId), eq(paceGroups.batchId, batchId)));

  if (!paceGroup) {
    throw new PacingError(
      "PACE_GROUP_NOT_FOUND",
      `Pace group with id '${paceGroupId}' not found in batch '${batchId}'.`
    );
  }

  // 1. Resolve current book and batch schedule state (independently of tasks)
  const bookResolution = await resolveCurrentBookForBatch(
    batchId,
    targetDateInput,
    executor
  );

  // 2. Propose next page range based on group's saved cursor and pace
  const proposedRange = proposeNextPageRange(paceGroup.cursor, paceGroup.size);

  // 3. Search reusable tasks library ONLY AFTER book and range are resolved
  let reusableTask: Task | null = null;
  let source: "reusable" | "draft" = "draft";

  if (bookResolution.currentBook) {
    const bookTasks = await executor
      .select()
      .from(tasks)
      .where(eq(tasks.bookId, bookResolution.currentBook.id));

    // Match reusable task for this book by dayNumber or matching page range in content
    const matchingTask = bookTasks.find(
      (t) =>
        t.dayNumber === bookResolution.dayNumber ||
        t.content.includes(`${proposedRange.startPage}–${proposedRange.endPage}`) ||
        t.content.includes(`${proposedRange.startPage}-${proposedRange.endPage}`)
    );

    if (matchingTask) {
      reusableTask = matchingTask;
      source = "reusable";
    }
  }

  const draftContent = `Read pages ${proposedRange.startPage}–${proposedRange.endPage}${
    bookResolution.currentBook ? ` of ${bookResolution.currentBook.title}` : ""
  }.`;

  return {
    batchId,
    paceGroupId: paceGroup.id,
    paceGroupName: paceGroup.name,
    pace: paceGroup.size,
    cursor: paceGroup.cursor,
    proposedPageRange: proposedRange,
    currentBook: bookResolution.currentBook,
    nextBook: bookResolution.nextBook,
    dayNumber: bookResolution.dayNumber,
    isStarted: bookResolution.isStarted,
    source,
    reusableTask,
    draftContent: reusableTask ? reusableTask.content : draftContent,
  };
}

/**
 * Publishes a task for a specific pace group:
 * - Allows pace admin range adjustments (e.g., from 9–18 to 9–15).
 * - Advances ONLY that pace group's cursor (to endPage).
 * - Strictly isolates batches and other pace groups.
 * - Does NOT mutate catalog books or global reusable tasks.
 */
export async function publishPaceGroupTask(
  input: PublishPaceGroupTaskInput,
  executor: DbOrTx = db
): Promise<PublishPaceGroupTaskResult> {
  const { batchId, paceGroupId, bookId, startPage, endPage, taskId } = input;

  if (endPage < startPage) {
    throw new PacingError(
      "INVALID_PAGE_RANGE",
      `endPage (${endPage}) cannot be less than startPage (${startPage}).`
    );
  }

  return await executor.transaction(async (tx) => {
    // 1. Verify pace group belongs to batch
    const [paceGroup] = await tx
      .select()
      .from(paceGroups)
      .where(and(eq(paceGroups.id, paceGroupId), eq(paceGroups.batchId, batchId)));

    if (!paceGroup) {
      throw new PacingError(
        "PACE_GROUP_NOT_FOUND",
        `Pace group '${paceGroupId}' not found in batch '${batchId}'.`
      );
    }

    // 2. Verify book exists in catalog
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, bookId));

    if (!book) {
      throw new PacingError("BOOK_NOT_FOUND", `Book '${bookId}' not found.`);
    }

    // 3. Update ONLY this pace group's cursor to endPage
    const previousCursor = paceGroup.cursor;
    const [updatedPaceGroup] = await tx
      .update(paceGroups)
      .set({
        cursor: endPage,
        updatedAt: new Date(),
      })
      .where(eq(paceGroups.id, paceGroupId))
      .returning();

    if (!updatedPaceGroup) {
      throw new PacingError(
        "TRANSACTION_FAILED",
        `Failed to update cursor for pace group '${paceGroupId}'.`
      );
    }

    return {
      paceGroup: updatedPaceGroup,
      previousCursor,
      newCursor: updatedPaceGroup.cursor,
      publishedRange: { startPage, endPage },
      bookId: book.id,
      taskId: taskId ?? null,
    };
  });
}

