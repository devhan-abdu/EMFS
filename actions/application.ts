"use server";

import { requireSession } from "@/lib/auth/authorize";

import {
  createApplicationSchema,
  type FormState,
} from "@/lib/validations/application";

import {
  createApplication,
  ApplicationError,
} from "@/lib/services/application/application";

import { PaceGroupPreference } from "@/db/schema";

export async function submitApplicationAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawPaceGroup = formData.get("paceGroup");

  const paceGroup =
    rawPaceGroup && rawPaceGroup !== "undefined" && rawPaceGroup !== "" ?
      (String(rawPaceGroup) as PaceGroupPreference)
    : undefined;

  const values = {
    batchId: String(formData.get("batchId") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    fatherName: String(formData.get("fatherName") ?? ""),
    grandfatherName:
      String(formData.get("grandfatherName") ?? "").trim() || undefined,
    email: String(formData.get("email") ?? ""),
    telegramUsername: String(formData.get("telegramUsername") ?? ""),
    phoneNumber: String(formData.get("phoneNumber") ?? ""),
    paceGroup,
  };

  const result = createApplicationSchema.safeParse(values);

  if (!result.success) {
    return {
      values,
      errors: result.error.flatten().fieldErrors,
      formError: null,
      success: false,
    };
  }

  try {
    const currentUser = await requireSession();

    await createApplication(
      currentUser.profile.id,
      currentUser.email,
      result.data,
    );

    return {
      values,
      errors: null,
      formError: null,
      success: true,
    };
  } catch (error) {
    if (error instanceof ApplicationError) {
      return {
        values,
        errors: null,
        formError: error.message,
        success: false,
      };
    }

    console.error("Unhandled application error:", error);

    return {
      values,
      errors: null,
      formError:
        error instanceof Error ?
          error.message
        : "Unable to submit application.",
      success: false,
    };
  }
}
