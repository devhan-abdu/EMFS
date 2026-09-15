import { z } from 'zod';

export const PACE_GROUP_SIZE_PRESETS = [5, 10, 20, 40] as const;

const paceSizeSchema = z.coerce
  .number()
  .int('Pace must be a whole number')
  .refine((v) => (PACE_GROUP_SIZE_PRESETS as readonly number[]).includes(v), {
    message: 'Pace must be one of 5, 10, 20, or 40 pages/day',
  });

export const createPaceGroupSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  name: z.string().trim().min(1, 'Group name is required').max(100),
  size: paceSizeSchema,
  /** Deliberate override of the batch's planned pace-group count. */
  overridePlannedCount: z.boolean().optional().default(false),
});
export type CreatePaceGroupInput = z.infer<typeof createPaceGroupSchema>;

export const updatePaceGroupSchema = z.object({
  paceGroupId: z.string().uuid('Invalid pace group ID'),
  name: z.string().trim().min(1, 'Group name is required').max(100).optional(),
  size: paceSizeSchema.optional(),
});
export type UpdatePaceGroupInput = z.infer<typeof updatePaceGroupSchema>;

export const archivePaceGroupSchema = z.object({
  paceGroupId: z.string().uuid('Invalid pace group ID'),
});
export type ArchivePaceGroupInput = z.infer<typeof archivePaceGroupSchema>;

export const listPaceGroupsSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  includeArchived: z.boolean().optional().default(false),
});
export type ListPaceGroupsInput = z.infer<typeof listPaceGroupsSchema>;
