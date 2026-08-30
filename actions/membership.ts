"use server";

import {
  createMembershipSchema,
  transitionMembershipSchema,
  moveMembershipSchema,
  reenterMembershipSchema,
} from "@/lib/validations/membership";
import {
  createBatchMembership,
  transitionBatchMembership,
  moveBatchMembership,
  reenterBatchMembership,
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
  const currentUser = await requireRole(["batch_admin", "super_admin"]);

  const parsed = transitionMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const membership = await transitionBatchMembership(
      parsed.data.membershipId,
      parsed.data.targetStatus,
      parsed.data.reason,
      currentUser.profile.id
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

export async function moveMembershipAction(input: unknown) {
  const currentUser = await requireRole(["batch_admin", "super_admin"]);

  const parsed = moveMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const membership = await moveBatchMembership(
      parsed.data.membershipId,
      parsed.data.newBatchId,
      currentUser.profile.id,
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

export async function reenterMembershipAction(input: unknown) {
  const currentUser = await requireRole(["batch_admin", "super_admin"]);

  const parsed = reenterMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const membership = await reenterBatchMembership(
      parsed.data.profileId,
      parsed.data.fromBatchId,
      parsed.data.toBatchId,
      parsed.data.targetStatus,
      currentUser.profile.id,
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
