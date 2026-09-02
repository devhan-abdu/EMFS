"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/authorize";
import { createBatchSchema } from "@/lib/validations/batch";
import { createBatch, BatchError } from "@/lib/services/batch";

export type CreateBatchActionState = {
  ok: boolean;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
  data?: unknown;
} | null;

export async function createBatchAction(
  prevStateOrInput: unknown,
  formData?: FormData
): Promise<CreateBatchActionState> {
  const currentUser = await requireRole(["super_admin"]);

  let raw: unknown = formData instanceof FormData ? formData : prevStateOrInput;

  if (raw instanceof FormData) {
    const adminIds = raw.getAll("adminIds").filter(Boolean) as string[];
    const parseNumber = (val: FormDataEntryValue | null) => {
      if (val === null || val === "") return undefined;
      const num = Number(val);
      return isNaN(num) ? val : num;
    };

    raw = {
      name: raw.get("name"),
      maxMembers: parseNumber(raw.get("maxMembers")),
      paceGroupCount: parseNumber(raw.get("paceGroupCount")),
      startDate: raw.get("startDate") || undefined,
      readingDaysPerWeek: parseNumber(raw.get("readingDaysPerWeek")),
      ...(adminIds.length > 0 ? { adminIds } : {}),
    };
  }

  const parsed = createBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    await createBatch(currentUser.profile.id, parsed.data);
  } catch (e) {
    if (e instanceof BatchError) {
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

  redirect("/batches");
}

export async function getPreviouslyAssignedBatchAdminsAction() {
  await requireRole(["super_admin"]);
  try {
    const { getPreviouslyAssignedBatchAdmins } = await import("@/lib/services/user-search");
    const data = await getPreviouslyAssignedBatchAdmins();
    return { ok: true as const, data };
  } catch (e) {
    return {
      ok: false as const,
      error: (e as Error).message,
    };
  }
}

export async function searchUsersAction(query: string) {
  await requireRole(["super_admin"]);
  try {
    const { searchUsers } = await import("@/lib/services/user-search");
    const data = await searchUsers(query);
    return { ok: true as const, data };
  } catch (e) {
    return {
      ok: false as const,
      error: (e as Error).message,
    };
  }
}

export { searchProfilesAction, listKnownBatchAdminsAction } from "@/actions/user-search";


