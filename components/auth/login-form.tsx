"use client";

import { useActionState } from "react";

import { signInAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

const seededSuperAdmin = {
  email: "admin@example.com",
  password: "Password123!",
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, null);

  const formErrors = state?.errors?.formErrors ?? [];
  const fieldErrors = state?.errors?.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          Local dev access
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Super admin sign in
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Seeded demo account for the admin dashboard.
        </p>
      </div>

      {formErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <ul className="list-inside list-disc space-y-1">
            {formErrors.map((error, index) => (
              <li key={`${error}-${index}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={seededSuperAdmin.email}
          required
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
        {fieldErrors.email && (
          <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue={seededSuperAdmin.password}
          required
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
        {fieldErrors.password && (
          <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.password[0]}</p>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        Seeded credentials: {seededSuperAdmin.email} / {seededSuperAdmin.password}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
