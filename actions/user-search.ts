'use server';

import { AuthzError, requireRole } from '@/lib/auth/authorize';
import { searchProfilesSchema } from '@/lib/validations/user-search';
import type { ProfileSearchResult } from '@/lib/validations/user-search';
import {
  searchProfiles,
  getPreviouslyAssignedBatchAdmins,
  getPreviouslyAssignedPaceAdmins,
  UserSearchError,
  type PaceAdminSearchResult,
} from '@/lib/services/user-search';

type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      errors: { formErrors: string[]; fieldErrors: Record<string, string[]> };
    };

const PROFILE_SEARCH_ROLES = ['batch_admin', 'super_admin'] as const;

export async function searchProfilesAction(
  input: unknown,
): Promise<ActionResult<ProfileSearchResult[]>> {
  await requireRole([...PROFILE_SEARCH_ROLES]);

  // Support either a plain string query or an object input
  const normalizedRaw = typeof input === 'string' ? { query: input } : input;

  const parsed = searchProfilesSchema.safeParse(normalizedRaw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const data = await searchProfiles(parsed.data);
    return { ok: true as const, data };
  } catch (e) {
    if (e instanceof UserSearchError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false as const,
      errors: { formErrors: [(e as Error).message], fieldErrors: {} },
    };
  }
}

export async function getPreviouslyAssignedBatchAdminsAction(): Promise<
  ActionResult<ProfileSearchResult[]>
> {
  await requireRole([...PROFILE_SEARCH_ROLES]);
  try {
    const data = await getPreviouslyAssignedBatchAdmins();
    return { ok: true as const, data };
  } catch (e) {
    return {
      ok: false as const,
      errors: { formErrors: [(e as Error).message], fieldErrors: {} },
    };
  }
}

export const listKnownBatchAdminsAction =
  getPreviouslyAssignedBatchAdminsAction;

export async function getPreviouslyAssignedPaceAdminsAction(): Promise<
  ActionResult<PaceAdminSearchResult[]>
> {
  try {
    await requireRole([...PROFILE_SEARCH_ROLES]);
    const data = await getPreviouslyAssignedPaceAdmins();
    return { ok: true as const, data };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (e instanceof UserSearchError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false as const,
      errors: { formErrors: [(e as Error).message], fieldErrors: {} },
    };
  }
}

export const listKnownPaceAdminsAction = getPreviouslyAssignedPaceAdminsAction;
