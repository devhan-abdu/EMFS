"use server";

import { requireSession, AuthzError } from "@/lib/auth/authorize";
import { toggleDailyProgressInputSchema } from "@/lib/validations/daily-progress";
import {
  recordDailyProgressForProfile,
  getDailyProgressForProfile,
  DailyProgressError,
  type ProgressMutationResult,
} from "@/lib/services/daily-progress";

export type DailyProgressActionState = {
  ok: boolean;
  data?: ProgressMutationResult["progress"];
  previousStatus?: "done" | "not_done" | null;
  statusChanged?: boolean;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
};

/**
 * Server Action to record or toggle daily reading progress for the authenticated member.
 *
 * Security Invariants:
 * 1. "use server" boundary protects internal execution.
 * 2. Actor profile ID is derived strictly from requireSession() — never from client input.
 * 3. Client input is strictly validated via Zod schema (only taskId/dailyTaskId, status, localDate allowed).
 * 4. Extraneous client fields (e.g. memberId, profileId, batchId, paceGroupId) are stripped and ignored.
 * 5. Domain and authorization errors are caught and sanitized to prevent leaking database internals.
 */
export async function toggleDailyProgressAction(
  input: unknown,
): Promise<DailyProgressActionState> {
  // 1. Authoritative session verification
  let currentUser;
  try {
    currentUser = await requireSession();
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false,
      errors: { formErrors: ["You must be signed in."], fieldErrors: {} },
    };
  }

  // 2. Validate client input payload
  const parsed = toggleDailyProgressInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  // 3. Mutate strictly for the authenticated member profile
  try {
    const result = await recordDailyProgressForProfile(
      currentUser.profile.id,
      {
        taskId: parsed.data.taskId,
        status: parsed.data.status,
        localDate: parsed.data.localDate,
      },
    );

    return {
      ok: true,
      data: result.progress,
      previousStatus: result.previousStatus,
      statusChanged: result.statusChanged,
    };
  } catch (e) {
    if (e instanceof DailyProgressError) {
      return {
        ok: false,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }

    // Sanitize unexpected errors
    return {
      ok: false,
      errors: {
        formErrors: [
          "An unexpected error occurred while saving your reading progress.",
        ],
        fieldErrors: {},
      },
    };
  }
}

/**
 * Server Action to query the authenticated member's progress record for a task.
 */
export async function getDailyProgressAction(
  input: unknown,
): Promise<DailyProgressActionState> {
  let currentUser;
  try {
    currentUser = await requireSession();
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false,
      errors: { formErrors: ["You must be signed in."], fieldErrors: {} },
    };
  }

  const parsed = toggleDailyProgressInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  try {
    const record = await getDailyProgressForProfile(
      currentUser.profile.id,
      parsed.data.taskId,
    );

    return {
      ok: true,
      data: record ?? undefined,
    };
  } catch (e) {
    if (e instanceof DailyProgressError) {
      return {
        ok: false,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }

    return {
      ok: false,
      errors: {
        formErrors: ["Failed to retrieve progress record."],
        fieldErrors: {},
      },
    };
  }
}
