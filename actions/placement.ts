'use server';

import { revalidatePath } from 'next/cache';
import {
  AuthzError,
  requireBatchAccess,
  requireSession,
} from '@/lib/auth/authorize';
import {
  assignMemberToPaceGroup,
  moveMemberToPaceGroup,
  bulkAssignMembersToPaceGroup,
  createMoveRequest,
  approveMoveRequest,
  rejectMoveRequest,
  PlacementError,
} from '@/lib/services/pace-groups/placement';
import {
  assignMemberPaceGroupSchema,
  moveMemberPaceGroupSchema,
  bulkAssignMembersPaceGroupSchema,
  createMoveRequestSchema,
  approveMoveRequestSchema,
  rejectMoveRequestSchema,
} from '@/lib/validations/placement';

export async function assignMemberAction(rawInput: unknown) {
  const parsed = assignMemberPaceGroupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const actor = await requireBatchAccess(parsed.data.batchId);
    const result = await assignMemberToPaceGroup(parsed.data, actor.profile.id);

    revalidatePath(`/admin/batches/${parsed.data.batchId}`);
    revalidatePath('/admin/pace-groups');

    return { ok: true as const, data: result };
  } catch (e) {
    if (
      e instanceof AuthzError ||
      (e instanceof Error && e.name === 'AuthzError')
    ) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (
      e instanceof PlacementError ||
      (e instanceof Error && e.name === 'PlacementError')
    ) {
      const err = e as PlacementError;
      if (
        err.code === 'PACE_GROUP_NOT_FOUND' ||
        err.code === 'PACE_GROUP_ARCHIVED'
      ) {
        return {
          ok: false as const,
          errors: {
            formErrors: [],
            fieldErrors: { paceGroupId: [err.message] },
          },
        };
      }
      if (
        err.code === 'MEMBER_NOT_ENROLLED' ||
        err.code === 'MEMBER_ALREADY_PLACED'
      ) {
        return {
          ok: false as const,
          errors: {
            formErrors: [],
            fieldErrors: { profileId: [err.message] },
          },
        };
      }
      return {
        ok: false as const,
        errors: { formErrors: [err.message], fieldErrors: {} },
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

export async function moveMemberAction(rawInput: unknown) {
  const parsed = moveMemberPaceGroupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const actor = await requireBatchAccess(parsed.data.batchId);
    const result = await moveMemberToPaceGroup(parsed.data, actor.profile.id);

    revalidatePath(`/admin/batches/${parsed.data.batchId}`);
    revalidatePath('/admin/pace-groups');

    return { ok: true as const, data: result };
  } catch (e) {
    if (
      e instanceof AuthzError ||
      (e instanceof Error && e.name === 'AuthzError')
    ) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (
      e instanceof PlacementError ||
      (e instanceof Error && e.name === 'PlacementError')
    ) {
      const err = e as PlacementError;
      if (
        err.code === 'PACE_GROUP_NOT_FOUND' ||
        err.code === 'PACE_GROUP_ARCHIVED' ||
        err.code === 'SAME_PACE_GROUP'
      ) {
        return {
          ok: false as const,
          errors: {
            formErrors: [],
            fieldErrors: { toPaceGroupId: [err.message] },
          },
        };
      }
      if (
        err.code === 'MEMBER_NOT_ENROLLED' ||
        err.code === 'MEMBER_NOT_PLACED'
      ) {
        return {
          ok: false as const,
          errors: {
            formErrors: [],
            fieldErrors: { profileId: [err.message] },
          },
        };
      }
      return {
        ok: false as const,
        errors: { formErrors: [err.message], fieldErrors: {} },
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

export async function bulkAssignMembersAction(rawInput: unknown) {
  const parsed = bulkAssignMembersPaceGroupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const actor = await requireBatchAccess(parsed.data.batchId);
    const result = await bulkAssignMembersToPaceGroup(
      parsed.data,
      actor.profile.id,
    );

    revalidatePath(`/admin/batches/${parsed.data.batchId}`);
    revalidatePath('/admin/pace-groups');

    return { ok: true as const, data: result };
  } catch (e) {
    if (
      e instanceof AuthzError ||
      (e instanceof Error && e.name === 'AuthzError')
    ) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (
      e instanceof PlacementError ||
      (e instanceof Error && e.name === 'PlacementError')
    ) {
      const err = e as PlacementError;
      if (
        err.code === 'PACE_GROUP_NOT_FOUND' ||
        err.code === 'PACE_GROUP_ARCHIVED'
      ) {
        return {
          ok: false as const,
          errors: {
            formErrors: [],
            fieldErrors: { targetGroupId: [err.message] },
          },
        };
      }
      if (err.code === 'MEMBER_NOT_ENROLLED') {
        return {
          ok: false as const,
          errors: {
            formErrors: [],
            fieldErrors: { profileIds: [err.message] },
          },
        };
      }
      return {
        ok: false as const,
        errors: { formErrors: [err.message], fieldErrors: {} },
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

export async function approveMoveRequestAction(rawInput: unknown) {
  const parsed = approveMoveRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const actor = await requireBatchAccess(parsed.data.batchId);
    const result = await approveMoveRequest(parsed.data, actor.profile.id);

    revalidatePath(`/admin/batches/${parsed.data.batchId}`);
    revalidatePath('/admin/pace-groups');

    return { ok: true as const, data: result };
  } catch (e) {
    if (
      e instanceof AuthzError ||
      (e instanceof Error && e.name === 'AuthzError')
    ) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (
      e instanceof PlacementError ||
      (e instanceof Error && e.name === 'PlacementError')
    ) {
      const err = e as PlacementError;
      return {
        ok: false as const,
        errors: { formErrors: [err.message], fieldErrors: {} },
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

export async function rejectMoveRequestAction(rawInput: unknown) {
  const parsed = rejectMoveRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const actor = await requireBatchAccess(parsed.data.batchId);
    const result = await rejectMoveRequest(parsed.data, actor.profile.id);

    revalidatePath(`/admin/batches/${parsed.data.batchId}`);
    revalidatePath('/admin/pace-groups');

    return { ok: true as const, data: result };
  } catch (e) {
    if (
      e instanceof AuthzError ||
      (e instanceof Error && e.name === 'AuthzError')
    ) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (
      e instanceof PlacementError ||
      (e instanceof Error && e.name === 'PlacementError')
    ) {
      const err = e as PlacementError;
      return {
        ok: false as const,
        errors: { formErrors: [err.message], fieldErrors: {} },
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

export async function createMoveRequestAction(rawInput: unknown) {
  const parsed = createMoveRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const session = await requireSession();
    if (
      session.profile.role !== 'super_admin' &&
      session.profile.role !== 'batch_admin'
    ) {
      if (parsed.data.profileId !== session.profile.id) {
        throw new AuthzError(
          'FORBIDDEN',
          'You can only submit move requests for your own profile.',
        );
      }
    }

    const result = await createMoveRequest(parsed.data);

    revalidatePath(`/admin/batches/${parsed.data.batchId}`);
    revalidatePath('/admin/pace-groups');

    return { ok: true as const, data: result };
  } catch (e) {
    if (
      e instanceof AuthzError ||
      (e instanceof Error && e.name === 'AuthzError')
    ) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (
      e instanceof PlacementError ||
      (e instanceof Error && e.name === 'PlacementError')
    ) {
      const err = e as PlacementError;
      return {
        ok: false as const,
        errors: { formErrors: [err.message], fieldErrors: {} },
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
