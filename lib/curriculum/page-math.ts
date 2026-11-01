import { PAGE_UNIT } from './constants';
import type { PageRange } from './types';

export { PAGE_UNIT };

/**
 * Parameters for proposing a page range for a reading task.
 */
export interface ProposeRangeParams {
  cursor: number;
  size: number;
  pageCount: number;
  delta?: number;
}

/**
 * Helper to construct a PageRange object with { start, end } as enumerable properties
 * and { startPage, endPage } as non-enumerable getters for backward compatibility.
 */
export function createPageRange(start: number, end: number): PageRange {
  const range = { start, end };
  Object.defineProperties(range, {
    startPage: {
      get() {
        return this.start;
      },
      enumerable: false,
      configurable: true,
    },
    endPage: {
      get() {
        return this.end;
      },
      enumerable: false,
      configurable: true,
    },
  });
  return range as PageRange;
}

/**
 * Helper to clamp a numeric value within [min, max].
 */
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Proposes the next 1-indexed inclusive reading page range [start, end]
 * based on current reading cursor, pace size, book page count, and manual adjustment delta.
 *
 * @param params - Object containing cursor, size, pageCount, and delta
 * @returns Proposed PageRange { start, end } or null if cursor is already at or past the end of the book.
 * @throws RangeError if pageCount <= 0, cursor < 0, size <= 0, or delta is not a multiple of PAGE_UNIT (5).
 */
export function proposeRange({
  cursor,
  size,
  pageCount,
  delta = 0,
}: ProposeRangeParams): PageRange | null {
  if (!Number.isFinite(pageCount) || pageCount <= 0) {
    throw new RangeError(
      `pageCount must be greater than 0, received ${pageCount}`,
    );
  }

  if (!Number.isFinite(cursor) || cursor < 0) {
    throw new RangeError(
      `cursor must be greater than or equal to 0, received ${cursor}`,
    );
  }

  // Rule A: If cursor >= pageCount, immediately return null (the book is finished for this group).
  if (cursor >= pageCount) {
    return null;
  }

  if (!Number.isFinite(size) || size <= 0) {
    throw new RangeError(`size must be greater than 0, received ${size}`);
  }

  // Rule B: delta must be an exact multiple of PAGE_UNIT. If it is not, throw a RangeError.
  if (!Number.isFinite(delta) || delta % PAGE_UNIT !== 0) {
    throw new RangeError(
      `delta must be a multiple of PAGE_UNIT (${PAGE_UNIT}), received ${delta}`,
    );
  }

  // Rule C: Calculate span = clamp(size + delta, 5, size * 2).
  const span = clamp(size + delta, 5, size * 2);

  // Rule D: Set start = cursor + 1.
  const start = cursor + 1;

  // Rule E: Set end = min(cursor + span, pageCount).
  const end = Math.min(cursor + span, pageCount);

  return createPageRange(start, end);
}

/**
 * Calculates total reading days required to complete a book given its page count and daily pace size.
 *
 * @param pageCount - Total number of pages in the book
 * @param size - Daily reading pace size (pages per day)
 * @throws RangeError if size <= 0 or pageCount < 0
 */
export function totalReadingDays(pageCount: number, size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new RangeError(`size must be greater than 0, received ${size}`);
  }

  if (!Number.isFinite(pageCount) || pageCount < 0) {
    throw new RangeError(`pageCount cannot be negative, received ${pageCount}`);
  }

  if (pageCount === 0) {
    return 0;
  }

  return Math.ceil(pageCount / size);
}
