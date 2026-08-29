"use server";

import { requireRole } from "@/lib/auth/authorize";
import {
  createBatchSchema,
  assignBatchAdminSchema,
} from "@/lib/validations/batch";
import {
  createBatch,
  assignBatchAdmin,
  BatchError,
} from "@/lib/services/batch";

export async function createBatchAction(input: unknown) {
  const currentUser = await requireRole(["super_admin"]);

  const parsed = createBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const result = await createBatch(currentUser.profile.id, parsed.data);
    return { ok: true as const, data: result };
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
}

export async function assignBatchAdminAction(input: unknown) {
  await requireRole(["super_admin"]);

  const parsed = assignBatchAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const result = await assignBatchAdmin(
      parsed.data.batchId,
      parsed.data.profileId
    );
    return { ok: true as const, data: result };
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
}

export const assignAdminAction = assignBatchAdminAction;

