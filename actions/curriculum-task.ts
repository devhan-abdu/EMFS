'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  AuthzError,
  requireBatchAccessForPaceGroup,
} from '@/lib/auth/authorize';
import { createAndPublishPioneerTask } from '@/lib/services/curriculum/publish-pioneer-task';
import { publishFollowerTask } from '@/lib/services/curriculum/publish-follower-task';

const baseTaskFields = {
  batchId: z.string().uuid(),
  paceGroupId: z.string().uuid(),
  batchDayNumber: z.coerce.number().int().nonnegative(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduledDate must be YYYY-MM-DD'),
};

const pioneerTaskSchema = z.object({
  ...baseTaskFields,
  stepNumber: z.coerce.number().int().positive(),
  caption: z.string().trim().min(1, 'Caption is required'),
  startPage: z.coerce.number().int().positive(),
  endPage: z.coerce.number().int().positive(),
  captionAm: z.string().trim().optional().or(z.literal('')),
  imageUrl: z.string().trim().url().optional().or(z.literal('')),
});

const followerTaskSchema = z.object({
  ...baseTaskFields,
  curriculumStepId: z.string().uuid(),
  localCaptionOverride: z.string().trim().optional().or(z.literal('')),
});

function normalizeOptionalString(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export async function publishPioneerTaskAction(rawInput: unknown) {
  const parsed = pioneerTaskSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: parsed.error.flatten(),
    };
  }

  try {
    await requireBatchAccessForPaceGroup(
      parsed.data.paceGroupId,
      parsed.data.batchId,
    );

    if (parsed.data.startPage >= parsed.data.endPage) {
      return {
        ok: false as const,
        errors: {
          formErrors: ['startPage must be lower than endPage.'],
          fieldErrors: {
            startPage: ['startPage must be lower than endPage.'],
            endPage: ['startPage must be lower than endPage.'],
          },
        },
      };
    }

    const result = await createAndPublishPioneerTask({
      ...parsed.data,
      caption: parsed.data.caption.trim(),
      captionAm: normalizeOptionalString(parsed.data.captionAm),
      imageUrl: normalizeOptionalString(parsed.data.imageUrl),
    });

    revalidatePath(`/admin/b/${parsed.data.batchId}`);
    revalidatePath(`/admin/b/${parsed.data.batchId}/tasks`);

    return {
      ok: true as const,
      data: result,
    };
  } catch (error) {
    if (
      error instanceof AuthzError ||
      (error instanceof Error && error.name === 'AuthzError')
    ) {
      return {
        ok: false as const,
        errors: {
          formErrors: [error instanceof Error ? error.message : 'Forbidden'],
          fieldErrors: {},
        },
      };
    }

    return {
      ok: false as const,
      errors: {
        formErrors: [
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        ],
        fieldErrors: {},
      },
    };
  }
}

export async function publishFollowerTaskAction(rawInput: unknown) {
  const parsed = followerTaskSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: parsed.error.flatten(),
    };
  }

  try {
    await requireBatchAccessForPaceGroup(
      parsed.data.paceGroupId,
      parsed.data.batchId,
    );

    const result = await publishFollowerTask({
      ...parsed.data,
      localCaptionOverride: normalizeOptionalString(
        parsed.data.localCaptionOverride,
      ),
    });

    revalidatePath(`/admin/b/${parsed.data.batchId}`);
    revalidatePath(`/admin/b/${parsed.data.batchId}/tasks`);

    return {
      ok: true as const,
      data: result,
    };
  } catch (error) {
    if (
      error instanceof AuthzError ||
      (error instanceof Error && error.name === 'AuthzError')
    ) {
      return {
        ok: false as const,
        errors: {
          formErrors: [error instanceof Error ? error.message : 'Forbidden'],
          fieldErrors: {},
        },
      };
    }

    return {
      ok: false as const,
      errors: {
        formErrors: [
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        ],
        fieldErrors: {},
      },
    };
  }
}

export const createPioneerTaskAction = publishPioneerTaskAction;
export const createFollowerTaskAction = publishFollowerTaskAction;
