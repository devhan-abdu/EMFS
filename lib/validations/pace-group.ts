import { z } from 'zod';

const minPagesSchema = z.coerce
  .number()
  .int('Minimum pages must be a whole number')
  .min(1, 'Minimum pages must be at least 1');
const maxPagesSchema = z.coerce
  .number()
  .int('Maximum pages must be a whole number')
  .min(1, 'Maximum pages must be at least 1');

export const createPaceGroupBaseSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  name: z.string().trim().min(1, 'Group name is required').max(100),
  min_pages: minPagesSchema,
  max_pages: maxPagesSchema,
  /** Deliberate override of the batch's planned pace-group count. */
  overridePlannedCount: z.boolean().optional().default(false),
});

export const createPaceGroupSchema = createPaceGroupBaseSchema.refine(
  (value) => value.min_pages <= value.max_pages,
  {
    message: 'Minimum pages cannot exceed maximum pages',
    path: ['min_pages'],
  },
);
export type CreatePaceGroupInput = z.infer<typeof createPaceGroupSchema>;

export const updatePaceGroupSchema = z
  .object({
    paceGroupId: z.string().uuid('Invalid pace group ID'),
    name: z
      .string()
      .trim()
      .min(1, 'Group name is required')
      .max(100)
      .optional(),
    min_pages: minPagesSchema.optional(),
    max_pages: maxPagesSchema.optional(),
  })
  .refine(
    (value) =>
      value.min_pages === undefined ||
      value.max_pages === undefined ||
      value.min_pages <= value.max_pages,
    {
      message: 'Minimum pages cannot exceed maximum pages',
      path: ['min_pages'],
    },
  );
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
