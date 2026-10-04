import { z } from 'zod';

export const BATCH_WEEKDAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

export const batchWeekdaySchema = z.enum(BATCH_WEEKDAYS);

export const updateBatchCadenceSchema = z
  .object({
    batchId: z.string().uuid(),
    readingDaysPerWeek: z.coerce.number().int().min(1).max(7).default(1),
    readingDays: z.array(batchWeekdaySchema).default([]),
    attendanceDays: z.array(batchWeekdaySchema).default([]),
  })
  .transform((value) => ({
    ...value,
    readingDaysPerWeek:
      value.readingDays.length > 0
        ? Math.min(7, Math.max(1, value.readingDays.length))
        : value.readingDaysPerWeek,
  }));
