"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/authorize";
import { reviewApplicationSchema } from "@/lib/validations/application";
import {
  reviewApplication,
  ApplicationReviewError,
  type ReviewApplicationResult,
} from "@/lib/services/application/application-review";

type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      errors: { formErrors: string[]; fieldErrors: Record<string, string[]> };
    };

export async function reviewApplicationAction(
  input: unknown,
): Promise<ActionResult<ReviewApplicationResult>> {
  const currentUser = await requireRole(["batch_admin", "super_admin"]);

  const parsed = reviewApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten() };
  }

  try {
    const result = await reviewApplication(
      parsed.data.applicationId,
      parsed.data.decision,
      currentUser.profile.id,
    );
    revalidatePath("/admin/members");
    return { ok: true, data: result };
  } catch (e) {
    if (e instanceof ApplicationReviewError) {
      return {
        ok: false,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false,
      errors: { formErrors: [(e as Error).message], fieldErrors: {} },
    };
  }
}
