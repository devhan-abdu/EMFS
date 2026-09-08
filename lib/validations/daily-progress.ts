import { z } from "zod";

export const dailyProgressStatusSchema = z.enum(["done", "not_done"]);

export const toggleDailyProgressInputSchema = z
  .object({
    taskId: z.string().uuid("Invalid task ID format").optional(),
    dailyTaskId: z.string().uuid("Invalid task ID format").optional(),
    status: dailyProgressStatusSchema.optional().default("done"),
    localDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "localDate must be in YYYY-MM-DD format")
      .optional(),
  })
  .refine((data) => data.taskId || data.dailyTaskId, {
    message: "taskId or dailyTaskId is required",
    path: ["taskId"],
  })
  .transform((data) => ({
    taskId: (data.taskId || data.dailyTaskId) as string,
    status: data.status,
    localDate: data.localDate,
  }));

export type ToggleDailyProgressInput = z.infer<
  typeof toggleDailyProgressInputSchema
>;
