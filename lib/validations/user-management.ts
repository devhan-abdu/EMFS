import { z } from 'zod';
import { PACE_ADMIN_DUTIES } from '@/db/schema/pace-admin-assignments';

export const USER_LIST_PAGE_SIZE_DEFAULT = 20;
export const USER_LIST_PAGE_SIZE_MAX = 50;

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(USER_LIST_PAGE_SIZE_MAX)
    .default(USER_LIST_PAGE_SIZE_DEFAULT),
  q: z.string().trim().optional(),
  role: z
    .enum(['all', 'super_admin', 'batch_admin', 'pace_admin', 'member'])
    .default('all'),
  batchId: z.string().uuid().optional(),
  paceGroupId: z.string().uuid().optional(),
  telegram: z.enum(['all', 'linked', 'unlinked']).default('all'),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;

export const paceAssignmentItemSchema = z.object({
  paceGroupId: z.string().uuid('Invalid pace group ID'),
  duty: z.enum(PACE_ADMIN_DUTIES),
});

export const changeUserRoleSchema = z
  .object({
    targetProfileId: z.string().uuid('Invalid profile ID'),
    newRole: z.enum(['super_admin', 'batch_admin', 'pace_admin', 'member']),
    batchIds: z
      .array(z.string().uuid('Invalid batch ID'))
      .optional()
      .default([]),
    paceAssignments: z.array(paceAssignmentItemSchema).optional().default([]),
    reason: z.string().trim().max(500).optional(),
    confirmed: z.literal(true, {
      message: 'Explicit confirmation is required to change roles.',
    }),
  })
  .superRefine((data, ctx) => {
    if (data.newRole === 'batch_admin') {
      if (!data.batchIds || data.batchIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one batch must be selected for Batch Admin role.',
          path: ['batchIds'],
        });
      }
      if (data.batchIds && data.batchIds.length > 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A user can administer at most 5 batches.',
          path: ['batchIds'],
        });
      }
    }

    if (data.newRole === 'pace_admin') {
      if (!data.paceAssignments || data.paceAssignments.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'At least one pace group and duty must be selected for Pace Admin role.',
          path: ['paceAssignments'],
        });
      }
    }
  });

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
