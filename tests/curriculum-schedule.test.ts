import { describe, it, expect } from 'vitest';
import {
  productDateKey,
  effectiveDateForStep,
  stepForDate,
  validateNewOffset,
  addCalendarDays,
  diffCalendarDays,
  toDateKey,
} from '../lib/curriculum/schedule';
import { PRODUCT_TIMEZONE } from '../lib/curriculum/constants';
import type { ScheduleOffset } from '../lib/curriculum/types';

describe('Curriculum Schedule Pure Domain Logic', () => {
  describe('1. Six reading days per week cadence (Monday start)', () => {
    const startDate = '2026-09-07'; // Monday

    it('resolves step 1 to start date (2026-09-07)', () => {
      expect(effectiveDateForStep(startDate, 1, 6)).toBe('2026-09-07');
    });

    it('resolves step 6 to Saturday (2026-09-12)', () => {
      expect(effectiveDateForStep(startDate, 6, 6)).toBe('2026-09-12');
    });

    it('identifies Sunday (2026-09-13) as a rest day between step 6 and step 7', () => {
      const resolution = stepForDate(startDate, '2026-09-13', 6);
      expect(resolution).toEqual({
        state: 'rest_day',
        date: '2026-09-13',
        previousStep: 6,
        nextStep: 7,
        nextDate: '2026-09-14',
      });
    });

    it('resolves step 7 to Monday (2026-09-14), skipping Sunday', () => {
      expect(effectiveDateForStep(startDate, 7, 6)).toBe('2026-09-14');
    });
  });

  describe('2. Schedule offsets', () => {
    const startDate = '2026-09-07';

    it('resolves step 12 without offset to 2026-09-19', () => {
      expect(effectiveDateForStep(startDate, 12, 6, [])).toBe('2026-09-19');
    });

    it('resolves step 12 with +3 offset from step 12 to 2026-09-22', () => {
      const offsets: ScheduleOffset[] = [
        { effectiveFromDayNumber: 12, offsetDays: 3, reason: 'Holiday pause' },
      ];
      expect(effectiveDateForStep(startDate, 12, 6, offsets)).toBe(
        '2026-09-22',
      );
    });

    it('does not affect steps prior to the offset effective day', () => {
      const offsets: ScheduleOffset[] = [
        { effectiveFromDayNumber: 12, offsetDays: 3, reason: 'Holiday pause' },
      ];
      expect(effectiveDateForStep(startDate, 11, 6, offsets)).toBe(
        '2026-09-18',
      );
    });

    it('affects all steps subsequent to the offset effective day', () => {
      const offsets: ScheduleOffset[] = [
        { effectiveFromDayNumber: 12, offsetDays: 3, reason: 'Holiday pause' },
      ];
      // Step 13 without offset would be 2026-09-21 (+2 calendar days over Sunday).
      // With +3 offset, step 13 is 2026-09-21 + 3 = 2026-09-24.
      expect(effectiveDateForStep(startDate, 13, 6, offsets)).toBe(
        '2026-09-24',
      );
    });
  });

  describe('3. Batch independence', () => {
    it('produces the same step numbers on dates separated by exactly the start-date gap', () => {
      const batchAStart = '2026-09-07';
      const batchBStart = '2026-09-14'; // 7 days later
      const gap = diffCalendarDays(batchBStart, batchAStart);
      expect(gap).toBe(7);

      for (let step = 1; step <= 30; step++) {
        const dateA = effectiveDateForStep(batchAStart, step, 6);
        const dateB = effectiveDateForStep(batchBStart, step, 6);
        expect(diffCalendarDays(dateB, dateA)).toBe(7);
      }
    });
  });

  describe('4. validateNewOffset', () => {
    it('rejects offsetDays === 0', () => {
      const result = validateNewOffset([], {
        effectiveFromDayNumber: 5,
        offsetDays: 0,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toMatch(/cannot be 0/i);
      }
    });

    it('rejects non-integer offsetDays', () => {
      const result = validateNewOffset([], {
        effectiveFromDayNumber: 5,
        offsetDays: 1.5,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects effectiveFromDayNumber < 1', () => {
      const result = validateNewOffset([], {
        effectiveFromDayNumber: 0,
        offsetDays: 2,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects duplicate effectiveFromDayNumber', () => {
      const existing: ScheduleOffset[] = [
        { effectiveFromDayNumber: 10, offsetDays: 2 },
      ];
      const result = validateNewOffset(existing, {
        effectiveFromDayNumber: 10,
        offsetDays: 3,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toMatch(/already exists/i);
      }
    });

    it('rejects an offset that causes step reversal or collision (e.g. step 6 before step 5)', () => {
      // Step 5 is day 5. If step 6 has offset -2, step 6 becomes day 4 (before step 5).
      const result = validateNewOffset([], {
        effectiveFromDayNumber: 6,
        offsetDays: -2,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toMatch(/land on or before/i);
      }
    });

    it('accepts valid strictly increasing positive and negative offsets', () => {
      const resultPositive = validateNewOffset([], {
        effectiveFromDayNumber: 12,
        offsetDays: 3,
      });
      expect(resultPositive.ok).toBe(true);

      const existing: ScheduleOffset[] = [
        { effectiveFromDayNumber: 12, offsetDays: 3 },
      ];
      const resultSubsequent = validateNewOffset(existing, {
        effectiveFromDayNumber: 20,
        offsetDays: 2,
      });
      expect(resultSubsequent.ok).toBe(true);
    });
  });

  describe('5. productDateKey (Timezone Africa/Addis_Ababa UTC+3)', () => {
    it('correctly maps 2026-09-20T21:30:00Z to 2026-09-21 in Addis Ababa timezone', () => {
      expect(PRODUCT_TIMEZONE).toBe('Africa/Addis_Ababa');
      const instant = new Date('2026-09-20T21:30:00Z');
      expect(productDateKey(instant)).toBe('2026-09-21');
    });

    it('correctly maps 2026-09-20T20:59:59Z to 2026-09-20 in Addis Ababa timezone', () => {
      const instant = new Date('2026-09-20T20:59:59Z');
      expect(productDateKey(instant)).toBe('2026-09-20');
    });

    it('correctly maps 2026-09-20T21:00:00Z to 2026-09-21 (midnight Addis Ababa)', () => {
      const instant = new Date('2026-09-20T21:00:00Z');
      expect(productDateKey(instant)).toBe('2026-09-21');
    });
  });

  describe('6. stepForDate: before_start state', () => {
    const startDate = '2026-09-07';

    it('returns before_start when target date precedes batch start date', () => {
      const resolution = stepForDate(startDate, '2026-09-06', 6);
      expect(resolution).toEqual({
        state: 'before_start',
        startDate: '2026-09-07',
        targetDate: '2026-09-06',
        nextStep: 1,
        nextDate: '2026-09-07',
      });
    });

    it('returns before_start for dates far in the past', () => {
      const resolution = stepForDate(startDate, '2025-01-01', 6);
      expect(resolution).toEqual({
        state: 'before_start',
        startDate: '2026-09-07',
        targetDate: '2025-01-01',
        nextStep: 1,
        nextDate: '2026-09-07',
      });
    });
  });

  describe('7. stepForDate: scheduled state', () => {
    const startDate = '2026-09-07';

    it('returns scheduled on start date for step 1', () => {
      const resolution = stepForDate(startDate, '2026-09-07', 6);
      expect(resolution).toEqual({
        state: 'scheduled',
        step: 1,
        date: '2026-09-07',
      });
    });

    it('returns scheduled on day 6 for step 6', () => {
      const resolution = stepForDate(startDate, '2026-09-12', 6);
      expect(resolution).toEqual({
        state: 'scheduled',
        step: 6,
        date: '2026-09-12',
      });
    });

    it('returns scheduled for step 7 after rest day', () => {
      const resolution = stepForDate(startDate, '2026-09-14', 6);
      expect(resolution).toEqual({
        state: 'scheduled',
        step: 7,
        date: '2026-09-14',
      });
    });
  });

  describe('8. stepForDate: rest_day state', () => {
    const startDate = '2026-09-07';

    it('returns rest_day on Sunday 2026-09-13', () => {
      const resolution = stepForDate(startDate, '2026-09-13', 6);
      expect(resolution).toEqual({
        state: 'rest_day',
        date: '2026-09-13',
        previousStep: 6,
        nextStep: 7,
        nextDate: '2026-09-14',
      });
    });

    it('returns rest_day on multi-day pause caused by schedule offset', () => {
      const offsets: ScheduleOffset[] = [
        { effectiveFromDayNumber: 12, offsetDays: 3, reason: '3-day holiday' },
      ];
      // Step 11 is 2026-09-18 (Friday)
      // Step 12 is 2026-09-22 (Tuesday)
      // 2026-09-19 (Sat), 2026-09-20 (Sun), 2026-09-21 (Mon) are pause/rest days
      for (const pauseDate of ['2026-09-19', '2026-09-20', '2026-09-21']) {
        const resolution = stepForDate(startDate, pauseDate, 6, offsets);
        expect(resolution).toEqual({
          state: 'rest_day',
          date: pauseDate,
          previousStep: 11,
          nextStep: 12,
          nextDate: '2026-09-22',
        });
      }
    });
  });

  describe('9. Boundary and Cadence Variations', () => {
    it('supports daily reading (7 days/week, 0 rest days)', () => {
      const startDate = '2026-09-07';
      for (let s = 1; s <= 14; s++) {
        const expectedDate = addCalendarDays(startDate, s - 1);
        expect(effectiveDateForStep(startDate, s, 7)).toBe(expectedDate);

        const res = stepForDate(startDate, expectedDate, 7);
        expect(res).toEqual({
          state: 'scheduled',
          step: s,
          date: expectedDate,
        });
      }
    });

    it('supports 5 days/week (e.g. weekdays only with 2-day weekend rest)', () => {
      const startDate = '2026-09-07'; // Mon
      // Step 5 = Fri (2026-09-11)
      expect(effectiveDateForStep(startDate, 5, 5)).toBe('2026-09-11');
      // Sat & Sun are rest days
      expect(stepForDate(startDate, '2026-09-12', 5)).toEqual({
        state: 'rest_day',
        date: '2026-09-12',
        previousStep: 5,
        nextStep: 6,
        nextDate: '2026-09-14',
      });
      expect(stepForDate(startDate, '2026-09-13', 5)).toEqual({
        state: 'rest_day',
        date: '2026-09-13',
        previousStep: 5,
        nextStep: 6,
        nextDate: '2026-09-14',
      });
      // Step 6 = Mon (2026-09-14)
      expect(effectiveDateForStep(startDate, 6, 5)).toBe('2026-09-14');
    });

    it('throws error when step < 1', () => {
      expect(() => effectiveDateForStep('2026-09-07', 0, 6)).toThrow(
        /Step number must be an integer >= 1/,
      );
      expect(() => effectiveDateForStep('2026-09-07', -1, 6)).toThrow(
        /Step number must be an integer >= 1/,
      );
    });
  });

  describe('10. Multiple compounding offsets', () => {
    it('correctly compounds multiple sequential offsets', () => {
      const startDate = '2026-09-07';
      const offsets: ScheduleOffset[] = [
        { effectiveFromDayNumber: 5, offsetDays: 2 },
        { effectiveFromDayNumber: 10, offsetDays: 3 },
      ];

      // Before step 5 (e.g. step 4): 0 offset
      expect(effectiveDateForStep(startDate, 4, 6, offsets)).toBe('2026-09-10');

      // Step 5: +2 offset -> base 2026-09-11 + 2 = 2026-09-13 (Sunday)
      expect(effectiveDateForStep(startDate, 5, 6, offsets)).toBe('2026-09-13');

      // Step 10: +2 + 3 = +5 offset -> base 2026-09-17 + 5 = 2026-09-22
      expect(effectiveDateForStep(startDate, 10, 6, offsets)).toBe(
        '2026-09-22',
      );
    });
  });

  describe('11. Helper utilities', () => {
    it('toDateKey normalizes Date and string formats identically', () => {
      expect(toDateKey('2026-09-07T00:00:00.000Z')).toBe('2026-09-07');
      expect(toDateKey(new Date('2026-09-07T00:00:00.000Z'))).toBe(
        '2026-09-07',
      );
    });

    it('addCalendarDays handles month and year rollovers accurately', () => {
      expect(addCalendarDays('2026-02-28', 1)).toBe('2026-03-01');
      expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('diffCalendarDays computes exact day counts across leap years and months', () => {
      expect(diffCalendarDays('2026-09-14', '2026-09-07')).toBe(7);
      expect(diffCalendarDays('2026-09-07', '2026-09-14')).toBe(-7);
      expect(diffCalendarDays('2027-01-01', '2026-12-31')).toBe(1);
    });
  });
});
