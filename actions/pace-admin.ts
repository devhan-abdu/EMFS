'use server';

import { revalidatePath } from 'next/cache';
import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';
import { getPaceGroupById } from '@/lib/services/pace-groups/pace-group';
import {
  assignPaceAdmin,
  removePaceAdminAssignment,
  listPaceAdminAssignments,
  getPaceAdminAssignmentById,
  PaceAdminError,
} from '@/lib/services/pace-groups/pace-admin-assignment';
import {
  assignPaceAdminSchema,
  removePaceAdminAssignmentSchema,
  listPaceAdminAssignmentsSchema,
} from '@/lib/validations/pace-admin';

export async function assignPaceAdminAction(rawInput: unknown) {
  const parsed = assignPaceAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const group = await getPaceGroupById(parsed.data.paceGroupId);
    if (!group) {
      return {
        ok: false as const,
        errors: {
          formErrors: [],
          fieldErrors: { paceGroupId: ['Pace group not found.'] },
        },
      };
    }

    const actor = await requireBatchAccess(group.batchId);
    const result = await assignPaceAdmin(parsed.data, actor.profile.id);

    revalidatePath('/admin/pace-groups');
    revalidatePath('/admin/roles');

    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (e instanceof PaceAdminError) {
      if (e.code === 'PROFILE_NOT_FOUND') {
        return {
          ok: false as const,
          errors: { formErrors: [], fieldErrors: { profileId: [e.message] } },
        };
      }
      if (e.code === 'DUPLICATE_ASSIGNMENT') {
        return {
          ok: false as const,
          errors: { formErrors: [], fieldErrors: { duty: [e.message] } },
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

export async function removePaceAdminAssignmentAction(rawInput: unknown) {
  const parsed = removePaceAdminAssignmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const existing = await getPaceAdminAssignmentById(parsed.data.assignmentId);
    if (!existing) {
      return {
        ok: false as const,
        errors: {
          formErrors: [],
          fieldErrors: { assignmentId: ['Assignment not found.'] },
        },
      };
    }

    const group = await getPaceGroupById(existing.paceGroupId);
    if (group) {
      await requireBatchAccess(group.batchId);
    }

    const result = await removePaceAdminAssignment(parsed.data);

    revalidatePath('/admin/pace-groups');
    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AuthzError || e instanceof PaceAdminError) {
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

export async function getPaceAdminAssignmentsAction(rawInput: unknown) {
  const parsed = listPaceAdminAssignmentsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const group = await getPaceGroupById(parsed.data.paceGroupId);
    if (!group) {
      return {
        ok: false as const,
        errors: {
          formErrors: [],
          fieldErrors: { paceGroupId: ['Pace group not found.'] },
        },
      };
    }

    await requireBatchAccess(group.batchId);
    const result = await listPaceAdminAssignments(parsed.data);

    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AuthzError || e instanceof PaceAdminError) {
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
