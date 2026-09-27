import { PAGE_UNIT } from './constants';
import type { PageRange } from './types';

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
 * Helper to clamp a numeric value within [min, max].
 */
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Proposes the next 1-indexed inclusive reading page range [startPage, endPage]
 * based on current reading cursor, pace size, book page count, and manual adjustment delta.
 *
 * @param params - Object containing cursor, size, pageCount, and delta
 * @returns Proposed PageRange { startPage, endPage } or null if cursor is already at or past the end of the book.
 * @throws RangeError if delta is not a multiple of PAGE_UNIT (5).
 */
export function proposeRange({
  cursor,
  size,
  pageCount,
  delta = 0,
}: ProposeRangeParams): PageRange | null {
  if (cursor >= pageCount) {
    return null;
  }

  if (delta % PAGE_UNIT !== 0) {
    throw new RangeError(
      `delta must be a multiple of PAGE_UNIT (${PAGE_UNIT}), received ${delta}`,
    );
  }

  const span = clamp(size + delta, 5, size * 2);
  const start = cursor + 1;
  const end = Math.min(cursor + span, pageCount);

  return {
    startPage: start,
    endPage: end,
  };
}

/**
 * Calculates total reading days required to complete a book given its page count and daily pace size.
 *
 * @param pageCount - Total number of pages in the book
 * @param size - Daily reading pace size (pages per day)
 */
export function totalReadingDays(pageCount: number, size: number): number {
  if (size <= 0 || pageCount <= 0) {
    return 0;
  }
  return Math.ceil(pageCount / size);
}
