import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().trim().min(1, 'Batch name is required'),

  maxMembers: z
    .number({
      message: 'Max members must be a number',
    })
    .int('Max members must be an integer')
    .positive('Max members must be a positive integer'),

  paceGroupCount: z
    .number({
      message: 'Pace group count must be a number',
    })
    .int('Pace group count must be an integer')
    .min(0, 'Pace group count cannot be negative')
    .default(0),

  startDate: z.coerce
    .date({
      message: 'Invalid start date',
    })
    .refine(
      (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return date >= today;
      },
      {
        message: "Start date can't be in the past",
      },
    ),

  readingDaysPerWeek: z
    .number({
      message: 'Reading days per week must be a number',
    })
    .int('Reading days per week must be an integer')
    .min(1, 'Reading days per week must be between 1 and 7')
    .max(7, 'Reading days per week must be between 1 and 7')
    .default(6),

  registrationOpen: z.boolean().default(false),
  adminIds: z
    .array(z.string().uuid('Invalid admin UUID'))
    .min(1, 'At least 1 batch admin is required')
    .max(3, 'At most 3 batch admins can be assigned')
    .optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
