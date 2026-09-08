import { z } from "zod";

export const dailyProgressStatusSchema = z.enum(["done", "not_done"]);

export const toggleDailyProgressInputSchema = z.object({
  taskId: z.string().uuid("Invalid task ID format"),
  status: dailyProgressStatusSchema.optional().default("done"),
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "localDate must be in YYYY-MM-DD format")
    .optional(),
});

export type ToggleDailyProgressInput = z.infer<
  typeof toggleDailyProgressInputSchema
>;
