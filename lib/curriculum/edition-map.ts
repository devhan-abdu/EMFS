import type { PageRange } from './types';

/**
 * Anchor point mapping a program book edition page to a specific edition page.
 */
export interface EditionAnchor {
  programPage: number;
  editionPage: number;
}

/**
 * Configuration for mapping pages and ranges between program and paired edition books.
 */
export interface EditionMapConfig {
  programPageCount: number;
  editionPageCount: number;
  anchors?: EditionAnchor[];
}

/**
 * Helper to construct a PageRange object with { start, end } as enumerable properties
 * and { startPage, endPage } as non-enumerable getters for backward compatibility.
 */
function createPageRange(start: number, end: number): PageRange {
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
 * Mapper interface returned by `createEditionMapper`.
 */
export interface EditionMapper {
  /**
   * Evaluates the mapping function f(page) for a single program page.
   */
  f: (page: number) => number;
  /**
   * Alias for `f(page)`.
   */
  mapPage: (page: number) => number;
  /**
   * Maps a program page interval [start, end] to a contiguous edition page range.
   */
  mapRange: (
    start:
      | number
      | { start?: number; startPage?: number; end?: number; endPage?: number },
    end?: number,
  ) => PageRange;
}

/**
 * Validates the edition configuration and anchor points, verifying strict sorting and bounds,
 * and builds the sorted interpolation control points:
 * (0, 0) -> anchors -> (programPageCount, editionPageCount).
 *
 * @throws RangeError if pageCounts are <= 0, anchors are out of order, corrupt, or exceed book bounds.
 */
function validateAndBuildPoints(config: EditionMapConfig): EditionAnchor[] {
  const { programPageCount, editionPageCount, anchors = [] } = config;

  if (
    !Number.isFinite(programPageCount) ||
    programPageCount <= 0 ||
    !Number.isFinite(editionPageCount) ||
    editionPageCount <= 0
  ) {
    throw new RangeError(
      `Book page counts must be positive numbers, received programPageCount: ${programPageCount}, editionPageCount: ${editionPageCount}`,
    );
  }

  let prevProgram = 0;
  let prevEdition = 0;

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];

    if (
      !anchor ||
      typeof anchor !== 'object' ||
      !Number.isFinite(anchor.programPage) ||
      !Number.isFinite(anchor.editionPage)
    ) {
      throw new RangeError(`Corrupt anchor structure at index ${i}`);
    }

    const { programPage, editionPage } = anchor;

    // Validate that no anchor point exceeds the total pageCount bounds of either book edition
    if (programPage <= 0 || programPage >= programPageCount) {
      throw new RangeError(
        `Anchor programPage ${programPage} out of bounds (1..${programPageCount - 1})`,
      );
    }
    if (editionPage <= 0 || editionPage >= editionPageCount) {
      throw new RangeError(
        `Anchor editionPage ${editionPage} out of bounds (1..${editionPageCount - 1})`,
      );
    }

    // Verify that the incoming array of anchor points is strictly sorted by programPage and editionPage
    if (programPage <= prevProgram) {
      throw new RangeError(
        `Anchors must be strictly sorted by programPage. Anchor at index ${i} has programPage ${programPage} <= preceding ${prevProgram}`,
      );
    }
    if (editionPage <= prevEdition) {
      throw new RangeError(
        `Anchors must be strictly sorted by editionPage. Anchor at index ${i} has editionPage ${editionPage} <= preceding ${prevEdition}`,
      );
    }

    prevProgram = programPage;
    prevEdition = editionPage;
  }

  return [
    { programPage: 0, editionPage: 0 },
    ...anchors,
    { programPage: programPageCount, editionPage: editionPageCount },
  ];
}

/**
 * Pure piecewise-linear interpolation function f(page) that maps a program page number
 * to the corresponding edition page number using surrounding anchor points.
 *
 * @param page - 1-indexed program page number (or 0 for range boundary calculations)
 * @param config - Edition mapping configuration containing page counts and optional anchors
 * @returns Nearest-integer rounded mapped edition page
 * @throws RangeError if pageCounts or anchor points are invalid
 */
export function interpolateEditionPage(
  page: number,
  config: EditionMapConfig,
): number {
  const points = validateAndBuildPoints(config);

  if (page <= points[0].programPage) {
    return points[0].editionPage;
  }

  const lastPoint = points[points.length - 1];
  if (page >= lastPoint.programPage) {
    return lastPoint.editionPage;
  }

  // Find the segment containing page: points[i].programPage <= page <= points[i+1].programPage
  for (let i = 0; i < points.length - 1; i++) {
    const pA = points[i];
    const pB = points[i + 1];

    if (page >= pA.programPage && page <= pB.programPage) {
      if (pB.programPage === pA.programPage) {
        return Math.round(pB.editionPage);
      }

      const t = (page - pA.programPage) / (pB.programPage - pA.programPage);
      const interpolated =
        pA.editionPage + t * (pB.editionPage - pA.editionPage);
      return Math.round(interpolated);
    }
  }

  return Math.round(lastPoint.editionPage);
}

/**
 * Evaluates the mapping function f(page) for a single program page.
 * Alias for `interpolateEditionPage`.
 */
export const f = interpolateEditionPage;

/**
 * Creates a reusable edition mapper instance with pre-validated interpolation points.
 *
 * @param config - Edition mapping configuration
 * @throws RangeError if config or anchors are invalid
 */
export function createEditionMapper(config: EditionMapConfig): EditionMapper {
  const points = validateAndBuildPoints(config);

  const evalF = (page: number): number => {
    if (page <= points[0].programPage) {
      return points[0].editionPage;
    }

    const lastPoint = points[points.length - 1];
    if (page >= lastPoint.programPage) {
      return lastPoint.editionPage;
    }

    for (let i = 0; i < points.length - 1; i++) {
      const pA = points[i];
      const pB = points[i + 1];

      if (page >= pA.programPage && page <= pB.programPage) {
        if (pB.programPage === pA.programPage) {
          return Math.round(pB.editionPage);
        }

        const t = (page - pA.programPage) / (pB.programPage - pA.programPage);
        const interpolated =
          pA.editionPage + t * (pB.editionPage - pA.editionPage);
        return Math.round(interpolated);
      }
    }

    return Math.round(lastPoint.editionPage);
  };

  const mapRange = (
    startOrRange:
      | number
      | { start?: number; startPage?: number; end?: number; endPage?: number },
    maybeEnd?: number,
  ): PageRange => {
    let start: number;
    let end: number;

    if (typeof startOrRange === 'object' && startOrRange !== null) {
      start = startOrRange.start ?? startOrRange.startPage!;
      end = startOrRange.end ?? startOrRange.endPage!;
    } else {
      start = startOrRange;
      end = maybeEnd ?? startOrRange;
    }

    if (!Number.isFinite(start) || start <= 0) {
      throw new RangeError(`start must be greater than 0, received ${start}`);
    }
    if (!Number.isFinite(end) || end < start) {
      throw new RangeError(
        `end must be greater than or equal to start (${start}), received ${end}`,
      );
    }

    const mappedStart = evalF(start - 1) + 1;
    const mappedEnd = Math.max(evalF(end), mappedStart);

    return createPageRange(mappedStart, mappedEnd);
  };

  return {
    f: evalF,
    mapPage: evalF,
    mapRange,
  };
}

/**
 * Maps a program book reading range [start, end] to the corresponding edition reading range.
 * Uses `f(start - 1) + 1` for the start page to preserve strict contiguity across consecutive days.
 *
 * @param start - Start page number or PageRange object
 * @param endOrConfig - End page number or EditionMapConfig (if first arg is PageRange)
 * @param maybeConfig - EditionMapConfig (if first arg is start page number)
 */
export function mapRange(
  start:
    | number
    | { start?: number; startPage?: number; end?: number; endPage?: number },
  endOrConfig: number | EditionMapConfig,
  maybeConfig?: EditionMapConfig,
): PageRange {
  let config: EditionMapConfig;
  let startPage: number;
  let endPage: number;

  if (typeof start === 'object' && start !== null) {
    startPage = start.start ?? start.startPage!;
    endPage = start.end ?? start.endPage!;
    config = endOrConfig as EditionMapConfig;
  } else {
    startPage = start;
    endPage = endOrConfig as number;
    config = maybeConfig!;
  }

  const mapper = createEditionMapper(config);
  return mapper.mapRange(startPage, endPage);
}

/**
 * Alias for `mapRange` providing explicit domain naming.
 */
export const mapEditionRange = mapRange;
