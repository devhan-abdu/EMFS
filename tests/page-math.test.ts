import { describe, it, expect } from 'vitest';
import { proposeRange, totalReadingDays } from '../lib/curriculum/page-math';
import { PACE_SIZES } from '../lib/curriculum/constants';

describe('Curriculum Page-Math Domain Logic', () => {
  describe('1. Normal range', () => {
    it('calculates expected range when cursor = 210, size = 10, pageCount = 999, delta = 0', () => {
      const result = proposeRange({
        cursor: 210,
        size: 10,
        pageCount: 999,
        delta: 0,
      });
      expect(result).toEqual({ startPage: 211, endPage: 220 });
    });

    it('defaults delta to 0 when omitted', () => {
      const result = proposeRange({
        cursor: 210,
        size: 10,
        pageCount: 999,
      });
      expect(result).toEqual({ startPage: 211, endPage: 220 });
    });
  });

  describe('2. Final partial range', () => {
    it('clamps to pageCount on the last reading step (cursor = 315, size = 10, pageCount = 320, delta = 0)', () => {
      const result = proposeRange({
        cursor: 315,
        size: 10,
        pageCount: 320,
        delta: 0,
      });
      expect(result).toEqual({ startPage: 316, endPage: 320 });
    });
  });

  describe('3. Finished book', () => {
    it('returns null when cursor is equal to pageCount (cursor = 320, pageCount = 320)', () => {
      const result = proposeRange({
        cursor: 320,
        size: 10,
        pageCount: 320,
        delta: 0,
      });
      expect(result).toBeNull();
    });

    it('returns null when cursor exceeds pageCount (cursor = 325, pageCount = 320)', () => {
      const result = proposeRange({
        cursor: 325,
        size: 10,
        pageCount: 320,
        delta: 0,
      });
      expect(result).toBeNull();
    });
  });

  describe('4. Negative adjustment & Minimum span clamping', () => {
    it('clamps minimum span to 5 when delta is strongly negative (cursor = 210, size = 10, pageCount = 999, delta = -10)', () => {
      const result = proposeRange({
        cursor: 210,
        size: 10,
        pageCount: 999,
        delta: -10,
      });
      expect(result).toEqual({ startPage: 211, endPage: 215 });
    });

    it('clamps minimum span to 5 for large pace sizes with heavy negative delta (size = 40, delta = -50)', () => {
      const result = proposeRange({
        cursor: 0,
        size: 40,
        pageCount: 200,
        delta: -50,
      });
      expect(result).toEqual({ startPage: 1, endPage: 5 });
    });
  });

  describe('5. Invalid adjustment validation', () => {
    it('throws RangeError when delta is not a multiple of PAGE_UNIT (delta = 3)', () => {
      expect(() =>
        proposeRange({
          cursor: 210,
          size: 10,
          pageCount: 999,
          delta: 3,
        }),
      ).toThrow(RangeError);
    });

    it('throws RangeError for non-multiple floats or values (delta = 1, 2, 4, 7, 2.5)', () => {
      for (const invalidDelta of [1, 2, 4, 6, 7, 8, 9, 2.5, -3, -7]) {
        expect(() =>
          proposeRange({
            cursor: 100,
            size: 20,
            pageCount: 500,
            delta: invalidDelta,
          }),
        ).toThrow(RangeError);
      }
    });
  });

  describe('6. Larger valid adjustment & Maximum span clamping', () => {
    it('verifies that span cannot exceed size * 2 (size = 10, delta = 30 -> max span = 20)', () => {
      const result = proposeRange({
        cursor: 210,
        size: 10,
        pageCount: 999,
        delta: 30,
      });
      // size * 2 = 20, so start = 211, end = 230
      expect(result).toEqual({ startPage: 211, endPage: 230 });
    });

    it('allows valid expansion up to size * 2 (size = 20, delta = 20 -> span = 40)', () => {
      const result = proposeRange({
        cursor: 0,
        size: 20,
        pageCount: 500,
        delta: 20,
      });
      expect(result).toEqual({ startPage: 1, endPage: 40 });
    });

    it('clamps expansion beyond size * 2 (size = 20, delta = 35 -> clamped to span = 40)', () => {
      const result = proposeRange({
        cursor: 0,
        size: 20,
        pageCount: 500,
        delta: 35,
      });
      expect(result).toEqual({ startPage: 1, endPage: 40 });
    });
  });

  describe('7. Final-day clamping', () => {
    it('verifies end never exceeds pageCount even with large pace size or expansion', () => {
      const result = proposeRange({
        cursor: 318,
        size: 10,
        pageCount: 320,
        delta: 10,
      });
      expect(result).toEqual({ startPage: 319, endPage: 320 });
    });
  });

  describe('8. totalReadingDays', () => {
    it('calculates exact total reading days (320 pages / 10 pages/day === 32 days)', () => {
      expect(totalReadingDays(320, 10)).toBe(32);
    });

    it('rounds up partial final reading days', () => {
      expect(totalReadingDays(321, 10)).toBe(33);
      expect(totalReadingDays(329, 10)).toBe(33);
      expect(totalReadingDays(1, 10)).toBe(1);
    });

    it('handles zero or negative pageCount or size gracefully', () => {
      expect(totalReadingDays(0, 10)).toBe(0);
      expect(totalReadingDays(-50, 10)).toBe(0);
      expect(totalReadingDays(100, 0)).toBe(0);
      expect(totalReadingDays(100, -5)).toBe(0);
    });
  });

  describe('9. Additional boundary cases & Pace presets', () => {
    it('handles cursor immediately before pageCount (cursor = 319, pageCount = 320)', () => {
      const result = proposeRange({
        cursor: 319,
        size: 10,
        pageCount: 320,
        delta: 0,
      });
      expect(result).toEqual({ startPage: 320, endPage: 320 });
    });

    it('handles cursor at start of book (cursor = 0)', () => {
      const result = proposeRange({
        cursor: 0,
        size: 10,
        pageCount: 100,
        delta: 0,
      });
      expect(result).toEqual({ startPage: 1, endPage: 10 });
    });

    it('handles positive valid delta (+5)', () => {
      const result = proposeRange({
        cursor: 100,
        size: 20,
        pageCount: 500,
        delta: 5,
      });
      expect(result).toEqual({ startPage: 101, endPage: 125 });
    });

    it('handles negative valid delta (-5)', () => {
      const result = proposeRange({
        cursor: 100,
        size: 20,
        pageCount: 500,
        delta: -5,
      });
      expect(result).toEqual({ startPage: 101, endPage: 115 });
    });

    it('works cleanly across all canonical PACE_SIZES presets [5, 10, 20, 40]', () => {
      expect(PACE_SIZES).toEqual([5, 10, 20, 40]);

      for (const size of PACE_SIZES) {
        const result = proposeRange({
          cursor: 0,
          size,
          pageCount: 200,
          delta: 0,
        });
        expect(result).toEqual({ startPage: 1, endPage: size });
      }
    });

    it('handles pace size 5 with negative delta clamping to minimum span 5', () => {
      const result = proposeRange({
        cursor: 0,
        size: 5,
        pageCount: 100,
        delta: -5,
      });
      expect(result).toEqual({ startPage: 1, endPage: 5 });
    });

    it('handles pace size 40 with positive delta clamping to max span 80', () => {
      const result = proposeRange({
        cursor: 0,
        size: 40,
        pageCount: 500,
        delta: 60,
      });
      expect(result).toEqual({ startPage: 1, endPage: 80 });
    });
  });
});
