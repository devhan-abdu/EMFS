"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { registerMember } from "@/lib/services/registration";
import { signUpSchema, signInSchema, SignUpFormState, SignInFormState } from "@/lib/validations/auth";


function safeNext(next: FormDataEntryValue | null | undefined): string | null {
  if (typeof next !== "string" || !next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function defaultRedirectForRole(role: string | undefined): string {
  return (
      role === "super_admin" || role === "batch_admin" || role === "pace_admin"
    ) ?
      "/admin"
    : "/";
}



export async function signUpAction(
  _prevState: SignUpFormState,
  formData: FormData,
): Promise<SignUpFormState> {
  const values = {
    email: (formData.get("email") as string) ?? "",
    password: (formData.get("password") as string) ?? "",
    confirmPassword: (formData.get("confirmPassword") as string) ?? "",
  };

  const parsed = signUpSchema.safeParse(values);

  if (!parsed.success) {
    return {
      values,
      errors: parsed.error.flatten().fieldErrors,
      formError: null,
      success: false,
    };
  }

  try {
    await registerMember(parsed.data);

    return {
      values: {},
      errors: null,
      formError: null,
      success: true,
    };
  } catch (e) {
    return {
      values,
      errors: null,
      formError:
        (e as Error).message || "An unexpected error occurred during signup.",
      success: false,
    };
  }
}

export async function signInAction(
  _prevState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const next = safeNext(formData.get("next"));

  const values = {
    email: (formData.get("email") as string) ?? "",
    password: (formData.get("password") as string) ?? "",
  };

  const parsed = signInSchema.safeParse(values);

  if (!parsed.success) {
    return {
      values,
      errors: parsed.error.flatten().fieldErrors,
      formError: null,
      success: false,
    };
  }

  let signInResult;
  try {
    signInResult = await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    });
  } catch {
    return {
      values,
      errors: null,
      formError: "Invalid email or password.",
      success: false,
    };
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.authUserId, signInResult.user.id),
  });

  const targetUrl = next ?? defaultRedirectForRole(profile?.role);

  return {
    values: {},
    errors: null,
    formError: null,
    success: true,
    redirectTo: targetUrl,
  };
}
export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/signin");
}
