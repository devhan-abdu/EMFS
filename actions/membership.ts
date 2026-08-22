"use server";

import {
  createMembershipSchema,
  transitionMembershipSchema,
} from "@/lib/validations/membership";
import {
  createBatchMembership,
  transitionBatchMembership,
  MembershipError,
} from "@/lib/services/membership";
import { requireRole } from "@/lib/auth/authorize";

export async function createMembershipAction(input: unknown) {
  await requireRole(["batch_admin", "super_admin"]);

  const parsed = createMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const membership = await createBatchMembership(
      parsed.data.profileId,
      parsed.data.batchId,
      parsed.data.status
    );
    return { ok: true as const, data: membership };
  } catch (e) {
    if (e instanceof MembershipError) {
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

export async function transitionMembershipAction(input: unknown) {
  await requireRole(["batch_admin", "super_admin"]);

  const parsed = transitionMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const membership = await transitionBatchMembership(
      parsed.data.membershipId,
      parsed.data.targetStatus,
      parsed.data.reason
    );
    return { ok: true as const, data: membership };
  } catch (e) {
    if (e instanceof MembershipError) {
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
