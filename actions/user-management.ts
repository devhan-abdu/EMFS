'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/authorize';
import {
  changeUserRoleSchema,
  type ChangeUserRoleInput,
} from '@/lib/validations/user-management';
import {
  changeUserRole,
  getUserDetails,
  UserManagementError,
  type UserDetails,
} from '@/lib/services/admin/user-management';

export type ActionFieldError = {
  field: string;
  message: string;
  code?: string;
};

export type ChangeUserRoleActionState = {
  ok: boolean;
  fieldErrors?: ActionFieldError[];
  formError?: string;
  data?: { auditId: string };
} | null;

export async function changeUserRoleAction(
  _previousState: ChangeUserRoleActionState,
  formData: FormData,
): Promise<ChangeUserRoleActionState> {
  // First line: must verify actor role before input parsing
  const actor = await requireSuperAdmin();

  // Parse fields from formData
  const targetProfileId = formData.get('targetProfileId');
  const newRole = formData.get('newRole');
  const reason = formData.get('reason');
  const confirmed = formData.get('confirmed') === 'true';

  const batchIds = formData
    .getAll('batchIds')
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const paceAssignmentsRaw = formData.get('paceAssignments');
  let paceAssignments: unknown[] = [];
  if (
    typeof paceAssignmentsRaw === 'string' &&
    paceAssignmentsRaw.trim().length > 0
  ) {
    try {
      paceAssignments = JSON.parse(paceAssignmentsRaw);
    } catch {
      return {
        ok: false,
        formError: 'Invalid pace assignments payload format.',
      };
    }
  }

  const rawInput = {
    targetProfileId,
    newRole,
    batchIds,
    paceAssignments,
    reason: typeof reason === 'string' ? reason : undefined,
    confirmed,
  };

  const parsed = changeUserRoleSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: ActionFieldError[] = parsed.error.issues.map(
      (issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }),
    );
    return {
      ok: false,
      fieldErrors,
      formError: fieldErrors[0]?.message ?? 'Validation failed.',
    };
  }

  try {
    const result = await changeUserRole(actor.profile.id, parsed.data);
    revalidatePath('/admin/platform/users');
    revalidatePath('/admin/platform/roles');
    revalidatePath('/admin');
    return {
      ok: true,
      data: { auditId: result.auditId },
    };
  } catch (error) {
    if (error instanceof UserManagementError) {
      return {
        ok: false,
        formError: error.message,
      };
    }
    return {
      ok: false,
      formError: 'An unexpected error occurred while updating user role.',
    };
  }
}

export async function fetchUserDetailsAction(
  profileId: string,
): Promise<{ ok: boolean; data?: UserDetails; error?: string }> {
  await requireSuperAdmin();
  try {
    const details = await getUserDetails(profileId);
    if (!details) {
      return { ok: false, error: 'User profile not found.' };
    }
    return { ok: true, data: details };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch user details.',
    };
  }
}
