import { z } from "zod";

export const setBatchScheduleSchema = z.object({
  batchId: z.string().uuid(),
  startDate: z.coerce.date(),
  readingDaysPerWeek: z.number().int().min(1).max(7),
});

export type SetBatchScheduleInput = z.infer<typeof setBatchScheduleSchema>;

export const createPacingOffsetSchema = z.object({
  batchId: z.string().uuid(),
  effectiveFromDayNumber: z.number().int().positive(),
  offsetDays: z
    .number()
    .int()
    .refine((n) => n !== 0, { message: "offset_days must not be zero" }),
  reason: z.string().min(1),
  editorId: z.string().uuid(),
});

export type CreatePacingOffsetInput = z.infer<typeof createPacingOffsetSchema>;
