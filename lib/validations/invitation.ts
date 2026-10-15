import { z } from 'zod';

import { PACE_ADMIN_DUTIES } from '@/db/schema/pace-admin-assignments';

export const invitationRoleSchema = z.enum([
  'member',
  'pace_admin',
  'batch_admin',
  'super_admin',
]);

export const createInvitationSchema = z
  .object({
    email: z.union([z.string().email('Enter a valid email'), z.literal('')]),
    role: invitationRoleSchema,
    batchId: z.union([z.string().uuid(), z.literal('')]),
    paceGroupId: z.union([z.string().uuid(), z.literal('')]),
    paceDuty: z.union([z.enum(PACE_ADMIN_DUTIES), z.literal('')]),
  })
  .transform((input) => ({
    ...input,
    email: input.email || null,
    batchId: input.batchId || null,
    paceGroupId: input.paceGroupId || null,
    paceDuty: input.paceDuty || null,
  }))
  .superRefine((input, context) => {
    if (input.role === 'batch_admin' && !input.batchId) {
      context.addIssue({
        code: 'custom',
        path: ['batchId'],
        message: 'Select a batch for a batch admin invitation.',
      });
    }

    if (
      input.role === 'pace_admin' &&
      (!input.batchId || !input.paceGroupId || !input.paceDuty)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['paceGroupId'],
        message: 'Select a batch, pace group, and duty for a pace admin.',
      });
    }

    if (input.role !== 'pace_admin' && (input.paceGroupId || input.paceDuty)) {
      context.addIssue({
        code: 'custom',
        path: ['paceGroupId'],
        message: 'Pace group and duty are only valid for pace admins.',
      });
    }
  });

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{40,64}$/);
