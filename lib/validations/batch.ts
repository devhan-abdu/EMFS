import { z } from "zod";

export const PACING_TYPES = ["daily", "three_times_week", "custom"] as const;
export type PacingType = (typeof PACING_TYPES)[number];

export const createBatchSchema = z
  .object({
    name: z.string().trim().min(1, "Batch name is required"),
    maxMembers: z
      .number({ message: "Max members must be a number" })
      .int("Max members must be an integer")
      .positive("Max members must be a positive integer"),
    paceGroupCount: z
      .number({ message: "Pace group count must be a number" })
      .int("Pace group count must be an integer")
      .min(1, "Pace group count must be at least 1")
      .default(1),
    startDate: z.coerce.date({ message: "Invalid start date" }),
    pacingType: z.enum(PACING_TYPES, {
      message: "Pacing type must be one of: daily, three_times_week, custom",
    }),
    readingDaysPerWeek: z
      .number()
      .int()
      .min(1, "Reading days per week must be between 1 and 7")
      .max(7, "Reading days per week must be between 1 and 7")
      .optional(),
    adminIds: z
      .array(z.string().uuid("Invalid admin UUID"))
      .min(1, "At least 1 batch admin is required")
      .max(3, "At most 3 batch admins can be assigned")
      .optional(),
  })
  .refine(
    (data) =>
      !data.adminIds || new Set(data.adminIds).size === data.adminIds.length,
    {
      message:
        "The same user cannot be assigned to the same batch more than once",
      path: ["adminIds"],
    }
  );

export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const assignBatchAdminSchema = z
  .object({
    batchId: z.string().uuid("Invalid batch UUID"),
    profileId: z.string().uuid("Invalid profile UUID").optional(),
    adminId: z.string().uuid("Invalid admin UUID").optional(),
  })
  .refine((data) => Boolean(data.profileId || data.adminId), {
    message: "profileId or adminId is required",
    path: ["profileId"],
  })
  .transform((data) => ({
    batchId: data.batchId,
    profileId: (data.profileId || data.adminId)!,
  }));

export type AssignBatchAdminInput = z.infer<typeof assignBatchAdminSchema>;

export const assignBatchAdminsSchema = z.object({
  batchId: z.string().uuid("Invalid batch UUID"),
  adminIds: z
    .array(z.string().uuid("Invalid admin UUID"))
    .min(1, "At least 1 batch admin is required")
    .max(3, "At most 3 batch admins can be assigned")
    .refine((ids) => new Set(ids).size === ids.length, {
      message:
        "The same user cannot be assigned to the same batch more than once",
    }),
});

export type AssignBatchAdminsInput = z.infer<typeof assignBatchAdminsSchema>;

