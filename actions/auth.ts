"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { registerMember } from "@/lib/services/registration";
import { signUpSchema, signInSchema } from "@/lib/validations/auth";

export async function signUpAction(input: unknown) {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    await registerMember(parsed.data);
  } catch (e) {
    return {
      ok: false as const,
      errors: { formErrors: [(e as Error).message], fieldErrors: {} },
    };
  }

  redirect("/");
}

export async function signInAction(input: unknown) {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  try {
    await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    });
  } catch {
    return {
      ok: false as const,
      errors: { formErrors: ["Invalid email or password."], fieldErrors: {} },
    };
  }

  redirect("/");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
