'use server';

import { revalidatePath } from 'next/cache';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { batchMemberships } from '@/db/schema';
import {
  createMembershipSchema,
  transitionMembershipSchema,
  moveMembershipSchema,
  reenterMembershipSchema,
} from '@/lib/validations/membership';
import {
  createBatchMembership,
  transitionBatchMembership,
  moveBatchMembership,
  reenterBatchMembership,
  MembershipError,
} from '@/lib/services/membership';
import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';

export async function createMembershipAction(input: unknown) {
  const parsed = createMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    await requireBatchAccess(parsed.data.batchId);

    const membership = await createBatchMembership(
      parsed.data.profileId,
      parsed.data.batchId,
      parsed.data.status,
    );
    revalidatePath('/members');
    return { ok: true as const, data: membership };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
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
  const parsed = transitionMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const mem = await db.query.batchMemberships.findFirst({
      where: eq(batchMemberships.id, parsed.data.membershipId),
    });
    if (!mem) {
      return {
        ok: false as const,
        errors: { formErrors: ['Membership not found.'], fieldErrors: {} },
      };
    }

    const currentUser = await requireBatchAccess(mem.batchId);

    const membership = await transitionBatchMembership(
      parsed.data.membershipId,
      parsed.data.targetStatus,
      parsed.data.reason,
      currentUser.profile.id,
    );
    revalidatePath('/members');
    return { ok: true as const, data: membership };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
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
  const parsed = moveMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const mem = await db.query.batchMemberships.findFirst({
      where: eq(batchMemberships.id, parsed.data.membershipId),
    });
    if (!mem) {
      return {
        ok: false as const,
        errors: { formErrors: ['Membership not found.'], fieldErrors: {} },
      };
    }

    await requireBatchAccess(mem.batchId);
    const currentUser = await requireBatchAccess(parsed.data.newBatchId);

    const membership = await moveBatchMembership(
      parsed.data.membershipId,
      parsed.data.newBatchId,
      currentUser.profile.id,
      parsed.data.reason,
    );
    return { ok: true as const, data: membership };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
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
  const parsed = reenterMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const currentUser = await requireBatchAccess(parsed.data.toBatchId);

    const membership = await reenterBatchMembership(
      parsed.data.profileId,
      parsed.data.fromBatchId,
      parsed.data.toBatchId,
      parsed.data.targetStatus,
      currentUser.profile.id,
      parsed.data.reason,
    );
    return { ok: true as const, data: membership };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
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
