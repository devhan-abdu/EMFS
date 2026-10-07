import { PRODUCT_TIMEZONE } from './constants';
import type { DateKey, ScheduleOffset, StepResolution } from './types';

/**
 * Reusable cached Intl.DateTimeFormat for the canonical product timezone ('Africa/Addis_Ababa').
 */
const productDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PRODUCT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns the current (or supplied) instant formatted as a canonical YYYY-MM-DD DateKey
 * in the official product timezone ('Africa/Addis_Ababa').
 *
 * @param now - Date object, ISO date string, or timestamp (defaults to current system time)
 */
export function productDateKey(
  now: Date | string | number = new Date(),
): DateKey {
  const d = typeof now === 'object' ? now : new Date(now);
  return productDateFormatter.format(d);
}

/**
 * Normalizes Date or string into canonical YYYY-MM-DD DateKey format.
 */
export function toDateKey(date: Date | string): DateKey {
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Pure UTC calendar date addition without hour or DST drift.
 */
export function addCalendarDays(dateKey: DateKey, days: number): DateKey {
  const [year, month, day] = dateKey.slice(0, 10).split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure UTC calendar date difference in days (dateA - dateB).
 */
export function diffCalendarDays(dateA: DateKey, dateB: DateKey): number {
  const [yA, mA, dA] = dateA.slice(0, 10).split('-').map(Number);
  const [yB, mB, dB] = dateB.slice(0, 10).split('-').map(Number);
  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);
  return Math.round((utcA - utcB) / (24 * 60 * 60 * 1000));
}

/**
 * Calculates the effective calendar date for a 1-indexed curriculum reading step,
 * factoring in cohort start date, weekly reading cadence, and schedule exception offsets.
 *
 * @param startDate - Cohort start date (DateKey or Date)
 * @param step - 1-indexed curriculum reading step (must be >= 1)
 * @param readingDaysPerWeek - Weekly reading days cadence (1..7, default 6)
 * @param offsets - List of pacing exception offsets
 */
export function effectiveDateForStep(
  startDate: DateKey | Date,
  step: number,
  readingDaysPerWeek = 6,
  offsets: ScheduleOffset[] = [],
): DateKey {
  if (step < 1 || !Number.isInteger(step)) {
    throw new Error(`Step number must be an integer >= 1 (received ${step})`);
  }

  const startKey = toDateKey(startDate);
  const cadence = Math.max(1, Math.min(7, Math.floor(readingDaysPerWeek)));

  const stepOffset = step - 1;
  const fullWeeks = Math.floor(stepOffset / cadence);
  const remainingDays = stepOffset % cadence;
  const baseCalendarDays = fullWeeks * 7 + remainingDays;

  let effectiveDate = addCalendarDays(startKey, baseCalendarDays);

  // Apply relevant pacing offsets effective at or before this step
  const totalOffsetDays = offsets
    .filter((o) => o.effectiveFromDayNumber <= step)
    .reduce((sum, o) => sum + o.offsetDays, 0);

  if (totalOffsetDays !== 0) {
    effectiveDate = addCalendarDays(effectiveDate, totalOffsetDays);
  }

  return effectiveDate;
}

/**
 * Resolves the curriculum step status for a specific calendar date in a cohort schedule.
 * Returns a discriminated union for `before_start`, `scheduled`, or `rest_day`.
 *
 * @param startDate - Cohort start date
 * @param date - Target calendar date to resolve
 * @param readingDaysPerWeek - Weekly reading cadence (1..7, default 6)
 * @param offsets - Pacing exception offsets
 */
export function stepForDate(
  startDate: DateKey | Date,
  date: DateKey | Date,
  readingDaysPerWeek = 6,
  offsets: ScheduleOffset[] = [],
): StepResolution {
  const startKey = toDateKey(startDate);
  const targetKey = toDateKey(date);

  const step1Date = effectiveDateForStep(
    startKey,
    1,
    readingDaysPerWeek,
    offsets,
  );

  if (targetKey < step1Date) {
    return {
      state: 'before_start',
      startDate: startKey,
      targetDate: targetKey,
      nextStep: 1,
      nextDate: step1Date,
    };
  }

  // Find the highest step whose effective date is <= targetKey via binary search
  const daysDiff = Math.max(0, diffCalendarDays(targetKey, startKey));
  let low = 1;
  let high = Math.max(10, daysDiff * 2 + 10);

  while (
    effectiveDateForStep(startKey, high, readingDaysPerWeek, offsets) <=
    targetKey
  ) {
    high *= 2;
  }

  let bestStep = 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const dateForMid = effectiveDateForStep(
      startKey,
      mid,
      readingDaysPerWeek,
      offsets,
    );
    if (dateForMid <= targetKey) {
      bestStep = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const dateForBestStep = effectiveDateForStep(
    startKey,
    bestStep,
    readingDaysPerWeek,
    offsets,
  );

  if (dateForBestStep === targetKey) {
    return {
      state: 'scheduled',
      step: bestStep,
      date: targetKey,
    };
  }

  const nextStep = bestStep + 1;
  const nextDate = effectiveDateForStep(
    startKey,
    nextStep,
    readingDaysPerWeek,
    offsets,
  );

  return {
    state: 'rest_day',
    date: targetKey,
    previousStep: bestStep,
    nextStep,
    nextDate,
  };
}

export type ValidateOffsetResult = { ok: true } | { ok: false; reason: string };

/**
 * Validates a proposed schedule offset against existing cohort offsets.
 * Rejects 0-day offsets, non-integer inputs, duplicate day numbers, and any
 * offset that causes effective dates across affected steps to become non-strictly increasing.
 *
 * @param existingOffsets - Currently applied batch schedule offsets
 * @param newOffset - Proposed new offset to add
 */
export function validateNewOffset(
  existingOffsets: ScheduleOffset[],
  newOffset: ScheduleOffset,
): ValidateOffsetResult {
  if (newOffset.offsetDays === 0) {
    return { ok: false, reason: 'Offset days cannot be 0' };
  }

  if (!Number.isInteger(newOffset.offsetDays)) {
    return { ok: false, reason: 'Offset days must be an integer' };
  }

  if (
    newOffset.effectiveFromDayNumber < 1 ||
    !Number.isInteger(newOffset.effectiveFromDayNumber)
  ) {
    return {
      ok: false,
      reason: 'Effective day number must be an integer >= 1',
    };
  }

  if (
    existingOffsets.some(
      (o) => o.effectiveFromDayNumber === newOffset.effectiveFromDayNumber,
    )
  ) {
    return {
      ok: false,
      reason: `An offset for day ${newOffset.effectiveFromDayNumber} already exists`,
    };
  }

  const combinedOffsets = [...existingOffsets, newOffset].sort(
    (a, b) => a.effectiveFromDayNumber - b.effectiveFromDayNumber,
  );

  const maxStep = Math.max(
    100,
    ...combinedOffsets.map((o) => o.effectiveFromDayNumber + 50),
  );
  const anchorDate = '2026-01-01';

  for (let s = 1; s < maxStep; s++) {
    const currentEffective = effectiveDateForStep(
      anchorDate,
      s,
      6,
      combinedOffsets,
    );
    const nextEffective = effectiveDateForStep(
      anchorDate,
      s + 1,
      6,
      combinedOffsets,
    );

    if (nextEffective <= currentEffective) {
      return {
        ok: false,
        reason: `Offset causes step ${s + 1} (${nextEffective}) to land on or before step ${s} (${currentEffective})`,
      };
    }
  }

  return { ok: true };
}
