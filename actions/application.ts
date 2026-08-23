"use server";

import { requireSession } from "@/lib/auth/authorize";
import { createApplicationSchema } from "@/lib/validations/application";
import { createApplication, ApplicationError } from "@/lib/services/application";

export async function submitApplicationAction(input: unknown) {
  let currentUser;
  try {
    currentUser = await requireSession();
  } catch (e) {
    return {
      ok: false as const,
      errors: { formErrors: [(e as Error).message], fieldErrors: {} },
    };
  }

  const parsed = createApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    const app = await createApplication(
      currentUser.profile.id,
      currentUser.email,
      parsed.data
    );
    return { ok: true as const, data: app };
  } catch (e) {
    if (e instanceof ApplicationError) {
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
