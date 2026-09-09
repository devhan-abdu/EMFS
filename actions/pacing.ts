"use server";

import { requireRole, AuthzError, authzErrorToFieldError } from "@/lib/auth/authorize";
import {
  resolveCurrentBookSchema,
  getTodayTaskProposalSchema,
  publishPaceGroupTaskSchema,
  type ResolveCurrentBookInput,
  type GetTodayTaskProposalInput,
  type PublishPaceGroupTaskInput,
} from "@/lib/validations/pacing";
import {
  resolveCurrentBookForBatch,
  getTodayTaskProposal,
  publishPaceGroupTask,
  PacingError,
  type CurrentBookResolutionResult,
  type TodayTaskProposalResult,
  type PublishPaceGroupTaskResult,
} from "@/lib/services/pacing";

export type PacingActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      errors: Array<{ field: string; message: string; code?: string }>;
    };

/**
 * Action to resolve current book for a batch on a specific date.
 * Allowed for pace_admin, batch_admin, super_admin.
 */
export async function resolveCurrentBookAction(
  input: ResolveCurrentBookInput
): Promise<PacingActionResult<CurrentBookResolutionResult>> {
  try {
    await requireRole(["pace_admin", "batch_admin", "super_admin"]);
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  const parsed = resolveCurrentBookSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "form",
        message: i.message,
        code: i.code,
      })),
    };
  }

  try {
    const data = await resolveCurrentBookForBatch(
      parsed.data.batchId,
      parsed.data.date
    );
    return { ok: true, data };
  } catch (error) {
    if (error instanceof PacingError) {
      return {
        ok: false,
        errors: [{ field: "form", message: error.message, code: error.code }],
      };
    }
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message:
            error instanceof Error ? error.message : "An unexpected error occurred",
        },
      ],
    };
  }
}

/**
 * Action to lookup today's task proposal (current book, cursor, range, reusable task / draft).
 * Allowed for pace_admin, batch_admin, super_admin.
 */
export async function getTodayTaskProposalAction(
  input: GetTodayTaskProposalInput
): Promise<PacingActionResult<TodayTaskProposalResult>> {
  try {
    await requireRole(["pace_admin", "batch_admin", "super_admin"]);
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  const parsed = getTodayTaskProposalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "form",
        message: i.message,
        code: i.code,
      })),
    };
  }

  try {
    const data = await getTodayTaskProposal(
      parsed.data.batchId,
      parsed.data.paceGroupId,
      parsed.data.date
    );
    return { ok: true, data };
  } catch (error) {
    if (error instanceof PacingError) {
      return {
        ok: false,
        errors: [{ field: "form", message: error.message, code: error.code }],
      };
    }
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message:
            error instanceof Error ? error.message : "An unexpected error occurred",
        },
      ],
    };
  }
}

/**
 * Action to publish a pace group's daily task (with optional adjusted range) and advance cursor.
 * Allowed for pace_admin, batch_admin, super_admin.
 */
export async function publishPaceGroupTaskAction(
  input: PublishPaceGroupTaskInput
): Promise<PacingActionResult<PublishPaceGroupTaskResult>> {
  try {
    await requireRole(["pace_admin", "batch_admin", "super_admin"]);
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  const parsed = publishPaceGroupTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "form",
        message: i.message,
        code: i.code,
      })),
    };
  }

  try {
    const data = await publishPaceGroupTask(parsed.data);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof PacingError) {
      return {
        ok: false,
        errors: [{ field: "form", message: error.message, code: error.code }],
      };
    }
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message:
            error instanceof Error ? error.message : "An unexpected error occurred",
        },
      ],
    };
  }
}
