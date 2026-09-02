"use server";

import { requireRole } from "@/lib/auth/authorize";
import { searchProfilesSchema } from "@/lib/validations/user-search";
import type { ProfileSearchResult } from "@/lib/validations/user-search";
import {
  searchProfiles,
  getPreviouslyAssignedBatchAdmins,
  UserSearchError,
} from "@/lib/services/user-search";

type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      errors: { formErrors: string[]; fieldErrors: Record<string, string[]> };
    };

export async function searchProfilesAction(
  input: unknown,
): Promise<ActionResult<ProfileSearchResult[]>> {
  // Enforce super_admin only access
  await requireRole(["super_admin"]);

  // Support either a plain string query or an object input
  const normalizedRaw = typeof input === "string" ? { query: input } : input;

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
  await requireRole(["super_admin"]);
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

