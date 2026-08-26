"use server";

import { requireSession } from "@/lib/auth/authorize";
import {
  createWaitlistSchema,
  removeWaitlistSchema,
} from "@/lib/validations/waitlist";
import {
  addToWaitlist,
  removeFromWaitlist,
  WaitlistError,
} from "@/lib/services/waitlist";

export async function joinWaitlistAction(input: unknown) {
  let currentUser;
  try {
    currentUser = await requireSession();
  } catch (e) {
    return {
      ok: false as const,
      errors: { formErrors: [(e as Error).message], fieldErrors: {} },
    };
  }

  const parsed = createWaitlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const entry = await addToWaitlist(currentUser.profile.id, parsed.data.batchId);
    return { ok: true as const, data: entry };
  } catch (e) {
    if (e instanceof WaitlistError) {
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

export async function leaveWaitlistAction(input: unknown) {
  let currentUser;
  try {
    currentUser = await requireSession();
  } catch (e) {
    return {
      ok: false as const,
      errors: { formErrors: [(e as Error).message], fieldErrors: {} },
    };
  }

  const parsed = removeWaitlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const removed = await removeFromWaitlist(
      parsed.data.waitlistId,
      currentUser.profile.id,
      currentUser.profile.role
    );
    return { ok: true as const, data: removed };
  } catch (e) {
    if (e instanceof WaitlistError) {
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
