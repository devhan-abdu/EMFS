"use server";

import { requireRole } from "@/lib/auth/authorize";
import { searchProfilesSchema } from "@/lib/validations/user-search";

export async function searchProfilesAction(input: unknown) {
  // Enforce super_admin only access
  await requireRole(["super_admin"]);

  // Support either a plain string query or an object input
  const normalizedRaw = typeof input === "string" ? { query: input } : input;

  const parsed = searchProfilesSchema.safeParse(normalizedRaw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const { searchProfiles } = await import("@/lib/services/user-search");
    const data = await searchProfiles(parsed.data);
    return { ok: true as const, data };
  } catch (e) {
    const { UserSearchError } = await import("@/lib/services/user-search");
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

export async function listKnownBatchAdminsAction() {
  await requireRole(["super_admin"]);
  try {
    const { listKnownBatchAdmins } = await import("@/lib/services/user-search");
    const data = await listKnownBatchAdmins();
    return { ok: true as const, data };
  } catch (e) {
    return {
      ok: false as const,
      error: (e as Error).message,
    };
  }
}

