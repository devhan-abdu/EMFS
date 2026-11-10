import { describe, it, expect } from 'vitest';
import { proposeRange, totalReadingDays } from '../lib/curriculum/page-math';

describe('Curriculum Page-Math Domain Logic', () => {
  describe('proposeRange', () => {
    it('starts at the minimum page count and advances from the cursor', () => {
      expect(
        proposeRange({
          cursor: 210,
          minPages: 10,
          maxPages: 20,
          pageCount: 999,
        }),
      ).toEqual({ startPage: 211, endPage: 220 });
    });

    it('adjusts within the configured minimum and maximum', () => {
      expect(
        proposeRange({
          cursor: 0,
          minPages: 10,
          maxPages: 20,
          pageCount: 999,
          delta: 5,
        }),
      ).toEqual({ startPage: 1, endPage: 15 });

      expect(
        proposeRange({
          cursor: 0,
          minPages: 10,
          maxPages: 20,
          pageCount: 999,
          delta: 30,
        }),
      ).toEqual({ startPage: 1, endPage: 20 });
    });

    it('never goes below the configured minimum', () => {
      expect(
        proposeRange({
          cursor: 0,
          minPages: 10,
          maxPages: 20,
          pageCount: 999,
          delta: -10,
        }),
      ).toEqual({ startPage: 1, endPage: 10 });
    });

    it('clamps the final partial range to the book page count', () => {
      expect(
        proposeRange({
          cursor: 315,
          minPages: 10,
          maxPages: 20,
          pageCount: 320,
        }),
      ).toEqual({ startPage: 316, endPage: 320 });
    });

    it('returns null when the cursor is at or past the end of the book', () => {
      expect(
        proposeRange({
          cursor: 320,
          minPages: 10,
          maxPages: 20,
          pageCount: 320,
        }),
      ).toBeNull();
      expect(
        proposeRange({
          cursor: 325,
          minPages: 10,
          maxPages: 20,
          pageCount: 320,
        }),
      ).toBeNull();
    });

    it('rejects invalid page bounds and adjustment increments', () => {
      expect(() =>
        proposeRange({
          cursor: 0,
          minPages: 20,
          maxPages: 10,
          pageCount: 100,
        }),
      ).toThrow(RangeError);
      expect(() =>
        proposeRange({
          cursor: 0,
          minPages: 5,
          maxPages: 20,
          pageCount: 100,
          delta: 3,
        }),
      ).toThrow(RangeError);
    });

    it('works with arbitrary configured page bounds', () => {
      for (const [minPages, maxPages, delta] of [
        [7, 15, 10],
        [20, 25, 5],
      ]) {
        expect(
          proposeRange({
            cursor: 0,
            minPages,
            maxPages,
            pageCount: 100,
            delta,
          }),
        ).toEqual({ startPage: 1, endPage: maxPages });
      }
    });
  });

  describe('totalReadingDays', () => {
    it('calculates the number of days at the configured pace', () => {
      expect(totalReadingDays(320, 10)).toBe(32);
    });

    it('rounds up partial final days and handles invalid inputs', () => {
      expect(totalReadingDays(321, 10)).toBe(33);
      expect(totalReadingDays(329, 10)).toBe(33);
      expect(totalReadingDays(1, 10)).toBe(1);
      expect(totalReadingDays(0, 10)).toBe(0);
      expect(totalReadingDays(-50, 10)).toBe(0);
      expect(totalReadingDays(100, 0)).toBe(0);
      expect(totalReadingDays(100, -5)).toBe(0);
    });
  });
});
