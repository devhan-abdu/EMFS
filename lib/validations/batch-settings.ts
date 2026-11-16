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

export const updateScheduleSettingsSchema = z
  .object({
    batchId: z.string().uuid('Invalid batch ID'),
    paceGroupId: z
      .string()
      .uuid('Invalid pace group ID')
      .optional()
      .nullable()
      .transform((val) => (val === '' ? null : val)),
    readingDaysPerWeek: z.coerce.number().int().min(1).max(7).default(6),
    readingDays: z.array(batchWeekdaySchema).default([]),
    attendanceDay: z.string().optional().nullable(),
    attendanceTime: z.string().optional().nullable(),
  })
  .transform((value) => ({
    ...value,
    readingDaysPerWeek:
      value.readingDays.length > 0
        ? Math.min(7, Math.max(1, value.readingDays.length))
        : value.readingDaysPerWeek,
  }));

export type UpdateScheduleSettingsInput = z.infer<
  typeof updateScheduleSettingsSchema
>;

export const resetPaceGroupScheduleSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  paceGroupId: z.string().uuid('Invalid pace group ID'),
});

export type ResetPaceGroupScheduleInput = z.infer<
  typeof resetPaceGroupScheduleSchema
>;

export const createBatchBreakSchema = z
  .object({
    batchId: z.string().uuid('Invalid batch ID'),
    paceGroupId: z
      .string()
      .uuid('Invalid pace group ID')
      .optional()
      .nullable()
      .transform((val) => (val === '' ? null : val)),
    title: z
      .string()
      .min(1, 'Break title is required')
      .max(120, 'Break title must be 120 characters or fewer'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

export type CreateBatchBreakInput = z.infer<typeof createBatchBreakSchema>;

export const deleteBatchBreakSchema = z.object({
  breakId: z.string().uuid('Invalid break ID'),
  batchId: z.string().uuid('Invalid batch ID'),
});

export type DeleteBatchBreakInput = z.infer<typeof deleteBatchBreakSchema>;
