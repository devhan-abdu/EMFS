"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { registerMember } from "@/lib/services/registration";
import { signUpSchema, signInSchema } from "@/lib/validations/auth";


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

export async function signUpAction(_: unknown, formData?: FormData) {
  if (!formData) {
    return { ok: false as const, errors: { formErrors: [], fieldErrors: {} } };
  }

  const next = safeNext(formData.get("next"));
  const input = Object.fromEntries(formData.entries()) as Record<
    string,
    unknown
  >;
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

  redirect(next ?? "/");
}

export async function signInAction(_: unknown, formData?: FormData) {
  if (!formData) {
    return { ok: false as const, errors: { formErrors: [], fieldErrors: {} } };
  }

  const next = safeNext(formData.get("next"));
  const input = Object.fromEntries(formData.entries()) as Record<
    string,
    unknown
  >;
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

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(next ?? "/");
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.authUserId, session.user.id),
  });

  redirect(next ?? defaultRedirectForRole(profile?.role));
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/signin");
}
