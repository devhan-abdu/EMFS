'use server';

import { revalidatePath } from 'next/cache';
import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';
import {
  createPaceGroup,
  updatePaceGroup,
  archivePaceGroup,
  listPaceGroupsForBatch,
  getPaceGroupById,
  PaceGroupError,
} from '@/lib/services/pace-groups/pace-group';
import {
  createPaceGroupSchema,
  updatePaceGroupSchema,
  archivePaceGroupSchema,
  listPaceGroupsSchema,
} from '@/lib/validations/pace-group';

export async function createPaceGroupAction(rawInput: unknown) {
  const parsed = createPaceGroupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    await requireBatchAccess(parsed.data.batchId);
    const result = await createPaceGroup(parsed.data);

    revalidatePath('/admin/pace-groups');
    revalidatePath(`/admin/batches/${parsed.data.batchId}`);

    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (e instanceof PaceGroupError) {
      if (e.code === 'BATCH_NOT_FOUND') {
        return {
          ok: false as const,
          errors: { formErrors: [], fieldErrors: { batchId: [e.message] } },
        };
      }
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false as const,
      errors: {
        formErrors: [
          'An unexpected server error occurred. Please try again later.',
        ],
        fieldErrors: {},
      },
    };
  }
}

export async function updatePaceGroupAction(rawInput: unknown) {
  const parsed = updatePaceGroupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const existing = await getPaceGroupById(parsed.data.paceGroupId);
    if (!existing) {
      return {
        ok: false as const,
        errors: {
          formErrors: [],
          fieldErrors: { paceGroupId: ['Pace group not found.'] },
        },
      };
    }

    await requireBatchAccess(existing.batchId);
    const result = await updatePaceGroup(parsed.data);

    revalidatePath('/admin/pace-groups');
    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AuthzError || e instanceof PaceGroupError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false as const,
      errors: {
        formErrors: [
          'An unexpected server error occurred. Please try again later.',
        ],
        fieldErrors: {},
      },
    };
  }
}

export async function archivePaceGroupAction(rawInput: unknown) {
  const parsed = archivePaceGroupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const existing = await getPaceGroupById(parsed.data.paceGroupId);
    if (!existing) {
      return {
        ok: false as const,
        errors: {
          formErrors: [],
          fieldErrors: { paceGroupId: ['Pace group not found.'] },
        },
      };
    }

    await requireBatchAccess(existing.batchId);
    const result = await archivePaceGroup(parsed.data);

    revalidatePath('/admin/pace-groups');
    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AuthzError || e instanceof PaceGroupError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false as const,
      errors: {
        formErrors: [
          'An unexpected server error occurred. Please try again later.',
        ],
        fieldErrors: {},
      },
    };
  }
}

export async function getPaceGroupsAction(rawInput: unknown) {
  const parsed = listPaceGroupsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    await requireBatchAccess(parsed.data.batchId);
    const result = await listPaceGroupsForBatch(parsed.data);

    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AuthzError || e instanceof PaceGroupError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false as const,
      errors: {
        formErrors: [
          'An unexpected server error occurred. Please try again later.',
        ],
        fieldErrors: {},
      },
    };
  }
}
