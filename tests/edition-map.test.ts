import { describe, it, expect } from 'vitest';
import {
  f,
  interpolateEditionPage,
  createEditionMapper,
  mapRange,
  mapEditionRange,
  type EditionMapConfig,
} from '../lib/curriculum/edition-map';

describe('Curriculum Edition Mapping Pure Domain Logic', () => {
  describe('1. No anchors (linear scale-up)', () => {
    const config: EditionMapConfig = {
      programPageCount: 300,
      editionPageCount: 400,
    };

    it('maps range (211, 225) to { start: 281, end: 300 } (linear scale-up of 1.33x)', () => {
      const result = mapRange(211, 225, config);
      expect(result).toEqual({ start: 281, end: 300 });
      // Backward compatibility getters
      expect(result.startPage).toBe(281);
      expect(result.endPage).toBe(300);
    });

    it('maps page proportionally using the endpoints (0, 0) and (300, 400)', () => {
      // 150 / 300 * 400 = 200
      expect(f(150, config)).toBe(200);
      expect(interpolateEditionPage(150, config)).toBe(200);
      // 75 / 300 * 400 = 100
      expect(f(75, config)).toBe(100);
      // 225 / 300 * 400 = 300
      expect(f(225, config)).toBe(300);
    });
  });

  describe('2. Single anchor — range BEFORE the anchor', () => {
    const config: EditionMapConfig = {
      programPageCount: 300,
      editionPageCount: 400,
      anchors: [{ programPage: 150, editionPage: 210 }],
    };

    it('uses segment (0, 0) -> (150, 210) rather than whole-book average', () => {
      // Slope in segment 1 = 210 / 150 = 1.4
      // Whole-book slope would be 400 / 300 = 1.333
      // At page 100:
      // Segment interpolation: 100 * 1.4 = 140
      // Whole-book average: round(100 * 1.333) = 133
      expect(f(100, config)).toBe(140);
      expect(interpolateEditionPage(100, config)).toBe(140);

      // mapRange(51, 100):
      // mappedStart = f(50) + 1 = round(50 * 1.4) + 1 = 70 + 1 = 71
      // mappedEnd = max(f(100), 71) = max(140, 71) = 140
      const rangeResult = mapRange(51, 100, config);
      expect(rangeResult).toEqual({ start: 71, end: 140 });
    });
  });

  describe('3. Single anchor — range AFTER the anchor', () => {
    const config: EditionMapConfig = {
      programPageCount: 300,
      editionPageCount: 400,
      anchors: [{ programPage: 150, editionPage: 210 }],
    };

    it('uses segment (150, 210) -> (300, 400) rather than whole-book average', () => {
      // Segment 2: deltaP = 150, deltaE = 190. Slope = 190 / 150 = 1.2666...
      // At page 225 (midpoint between 150 and 300):
      // Segment interpolation: 210 + 0.5 * 190 = 210 + 95 = 305
      // Whole-book average: round(225 * 400/300) = 300
      expect(f(225, config)).toBe(305);
      expect(interpolateEditionPage(225, config)).toBe(305);

      // mapRange(151, 225):
      // mappedStart = f(150) + 1 = 210 + 1 = 211
      // mappedEnd = max(f(225), 211) = max(305, 211) = 305
      const rangeResult = mapRange(151, 225, config);
      expect(rangeResult).toEqual({ start: 211, end: 305 });
    });
  });

  describe('4. Exact anchor point evaluation', () => {
    const config: EditionMapConfig = {
      programPageCount: 300,
      editionPageCount: 400,
      anchors: [{ programPage: 150, editionPage: 210 }],
    };

    it('maps a page exactly at the anchor to the anchor editionPage', () => {
      expect(f(150, config)).toBe(210);
      expect(interpolateEditionPage(150, config)).toBe(210);
    });
  });

  describe('5. Page 0 and boundary endpoints behavior', () => {
    const config: EditionMapConfig = {
      programPageCount: 300,
      editionPageCount: 400,
      anchors: [{ programPage: 150, editionPage: 210 }],
    };

    it('maps page 0 to 0', () => {
      expect(interpolateEditionPage(0, config)).toBe(0);
    });

    it('maps final program page to editionPageCount', () => {
      expect(interpolateEditionPage(300, config)).toBe(400);
    });

    it('clamps negative pages to 0 and pages beyond pageCount to editionPageCount', () => {
      expect(interpolateEditionPage(-10, config)).toBe(0);
      expect(interpolateEditionPage(350, config)).toBe(400);
    });
  });

  describe('6. Edge cases and corrupt / out-of-order anchor rejection', () => {
    it('throws RangeError when anchor array is out-of-order by programPage', () => {
      const unsortedConfig: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
        anchors: [
          { programPage: 200, editionPage: 280 },
          { programPage: 100, editionPage: 120 },
        ],
      };

      expect(() => interpolateEditionPage(50, unsortedConfig)).toThrow(
        RangeError,
      );
      expect(() => createEditionMapper(unsortedConfig)).toThrow(RangeError);
      expect(() => mapRange(1, 20, unsortedConfig)).toThrow(RangeError);
    });

    it('throws RangeError when anchor array has duplicate programPage', () => {
      const duplicateProgramConfig: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
        anchors: [
          { programPage: 150, editionPage: 200 },
          { programPage: 150, editionPage: 220 },
        ],
      };

      expect(() => interpolateEditionPage(50, duplicateProgramConfig)).toThrow(
        RangeError,
      );
    });

    it('throws RangeError when anchor array has non-increasing editionPage', () => {
      const invertedEditionConfig: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
        anchors: [
          { programPage: 100, editionPage: 250 },
          { programPage: 150, editionPage: 200 },
        ],
      };

      expect(() => interpolateEditionPage(50, invertedEditionConfig)).toThrow(
        RangeError,
      );
    });

    it('throws RangeError when anchor exceeds programPageCount or editionPageCount bounds', () => {
      const outOfBoundsProg: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
        anchors: [{ programPage: 350, editionPage: 200 }],
      };
      expect(() => interpolateEditionPage(50, outOfBoundsProg)).toThrow(
        RangeError,
      );

      const outOfBoundsEd: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
        anchors: [{ programPage: 150, editionPage: 450 }],
      };
      expect(() => interpolateEditionPage(50, outOfBoundsEd)).toThrow(
        RangeError,
      );
    });

    it('throws RangeError when anchor coordinates are zero or negative', () => {
      const zeroProg: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
        anchors: [{ programPage: 0, editionPage: 100 }],
      };
      expect(() => interpolateEditionPage(50, zeroProg)).toThrow(RangeError);

      const negEd: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
        anchors: [{ programPage: 100, editionPage: -5 }],
      };
      expect(() => interpolateEditionPage(50, negEd)).toThrow(RangeError);
    });

    it('throws RangeError when book page counts are zero or negative', () => {
      expect(() =>
        interpolateEditionPage(50, {
          programPageCount: 0,
          editionPageCount: 100,
        }),
      ).toThrow(RangeError);

      expect(() =>
        interpolateEditionPage(50, {
          programPageCount: 100,
          editionPageCount: -10,
        }),
      ).toThrow(RangeError);
    });

    it('throws RangeError when mapRange receives invalid start or end pages', () => {
      const config: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
      };

      expect(() => mapRange(0, 10, config)).toThrow(RangeError);
      expect(() => mapRange(-5, 10, config)).toThrow(RangeError);
      expect(() => mapRange(20, 10, config)).toThrow(RangeError);
    });
  });

  describe('7. Multiple valid sorted anchors segment selection', () => {
    const config: EditionMapConfig = {
      programPageCount: 300,
      editionPageCount: 400,
      anchors: [
        { programPage: 100, editionPage: 120 }, // Seg 1: (0,0)->(100,120), slope 1.2
        { programPage: 200, editionPage: 280 }, // Seg 2: (100,120)->(200,280), slope 1.6
      ], // Seg 3: (200,280)->(300,400), slope 1.2
    };

    it('evaluates each segment independently according to surrounding anchors', () => {
      // Segment 1 (p = 50): 50 * 1.2 = 60
      expect(f(50, config)).toBe(60);

      // Segment 2 (p = 150): 120 + 0.5 * 160 = 200
      expect(f(150, config)).toBe(200);

      // Segment 3 (p = 250): 280 + 0.5 * 120 = 340
      expect(f(250, config)).toBe(340);
    });
  });

  describe('8. Rounding to nearest integer', () => {
    const config: EditionMapConfig = {
      programPageCount: 10,
      editionPageCount: 14, // slope = 1.4
    };

    it('rounds fractional interpolated values to the nearest integer', () => {
      // 1 * 1.4 = 1.4 -> round to 1
      expect(f(1, config)).toBe(1);
      // 2 * 1.4 = 2.8 -> round to 3
      expect(f(2, config)).toBe(3);
      // 3 * 1.4 = 4.2 -> round to 4
      expect(f(3, config)).toBe(4);
      // 4 * 1.4 = 5.6 -> round to 6
      expect(f(4, config)).toBe(6);
    });
  });

  describe('9. Consecutive-day rule (f(start - 1) + 1)', () => {
    const config: EditionMapConfig = {
      programPageCount: 300,
      editionPageCount: 400,
      anchors: [{ programPage: 150, editionPage: 210 }],
    };

    it('guarantees strictly contiguous mapped ranges across consecutive days with zero gaps or overlaps', () => {
      const mapper = createEditionMapper(config);

      // Daily reading ranges of 20 pages in program book:
      // Day 1: 1-20
      // Day 2: 21-40
      // Day 3: 41-60
      // ...
      // Day 15: 281-300
      let previousEnd = 0;

      for (let day = 1; day <= 15; day++) {
        const progStart = (day - 1) * 20 + 1;
        const progEnd = day * 20;

        const mapped = mapper.mapRange(progStart, progEnd);

        if (day === 1) {
          expect(mapped.start).toBe(1);
          expect(mapped.startPage).toBe(1);
        } else {
          // Strict contiguity: next start must equal previous end + 1
          expect(mapped.start).toBe(previousEnd + 1);
          expect(mapped.startPage).toBe(previousEnd + 1);
        }

        expect(mapped.end).toBeGreaterThanOrEqual(mapped.start);
        previousEnd = mapped.end;
      }

      // The final day must end at the total edition page count
      expect(previousEnd).toBe(400);
    });
  });

  describe('10. Mapped end is at least mapped start', () => {
    it('ensures end >= start for single page ranges', () => {
      const config: EditionMapConfig = {
        programPageCount: 500,
        editionPageCount: 100, // compressed edition (0.2x)
      };

      const result = mapRange(10, 10, config);
      expect(result.end).toBeGreaterThanOrEqual(result.start);
    });

    it('ensures end >= start when using mapEditionRange alias and PageRange object', () => {
      const config: EditionMapConfig = {
        programPageCount: 300,
        editionPageCount: 400,
      };

      const result = mapEditionRange({ start: 211, end: 225 }, config);
      expect(result).toEqual({ start: 281, end: 300 });
      expect(result.startPage).toBe(281);
      expect(result.endPage).toBe(300);
    });
  });
});
