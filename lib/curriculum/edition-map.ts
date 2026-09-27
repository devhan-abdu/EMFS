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
  mapRange: (start: number | PageRange, end?: number) => PageRange;
}

/**
 * Builds the sorted sequence of interpolation control points:
 * (0, 0) -> sorted anchors -> (programPageCount, editionPageCount).
 */
function buildInterpolationPoints(config: EditionMapConfig): EditionAnchor[] {
  const { programPageCount, editionPageCount, anchors = [] } = config;

  const sortedAnchors = [...anchors].sort(
    (a, b) => a.programPage - b.programPage,
  );

  return [
    { programPage: 0, editionPage: 0 },
    ...sortedAnchors,
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
 */
export function interpolateEditionPage(
  page: number,
  config: EditionMapConfig,
): number {
  const { programPageCount, editionPageCount } = config;

  if (programPageCount <= 0 || editionPageCount <= 0) {
    return 0;
  }

  const points = buildInterpolationPoints(config);

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
 * Creates a reusable edition mapper instance with pre-configured interpolation points.
 *
 * @param config - Edition mapping configuration
 */
export function createEditionMapper(config: EditionMapConfig): EditionMapper {
  const f = (page: number) => interpolateEditionPage(page, config);

  const mapRange = (
    startOrRange: number | PageRange,
    maybeEnd?: number,
  ): PageRange => {
    let start: number;
    let end: number;

    if (typeof startOrRange === 'object' && startOrRange !== null) {
      start = startOrRange.startPage;
      end = startOrRange.endPage;
    } else {
      start = startOrRange;
      end = maybeEnd ?? startOrRange;
    }

    const mappedStart = f(start - 1) + 1;
    const mappedEnd = Math.max(f(end), mappedStart);

    return {
      startPage: mappedStart,
      endPage: mappedEnd,
    };
  };

  return {
    f,
    mapPage: f,
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
  start: number | PageRange,
  endOrConfig: number | EditionMapConfig,
  maybeConfig?: EditionMapConfig,
): PageRange {
  let config: EditionMapConfig;
  let startPage: number;
  let endPage: number;

  if (typeof start === 'object' && start !== null) {
    startPage = start.startPage;
    endPage = start.endPage;
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
