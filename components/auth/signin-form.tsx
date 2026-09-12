"use client";

import * as React from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { signInAction } from "@/actions/auth";
import { type SignInFormState } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

export function SignInForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = next ?? searchParams.get("next");

  const [showPassword, setShowPassword] = React.useState(false);

  const initialState: SignInFormState = {
    values: {
      email: "",
      password: "",
    },
    errors: null,
    formError: null,
    success: false,
  };

  const [formState, formAction, pending] = React.useActionState<
    SignInFormState,
    FormData
  >(signInAction, initialState);

  React.useEffect(() => {
    if (formState.success) {
      toast.success("Signed in successfully!");
      const destination = formState.redirectTo ?? redirectTarget ?? "/";
      router.push(destination);
      router.refresh();
    } else if (formState.formError) {
      toast.error(formState.formError);
    }
  }, [
    formState.success,
    formState.formError,
    formState.redirectTo,
    redirectTarget,
    router,
  ]);

  return (
    <Form action={formAction} className="mt-8 space-y-5">
      {redirectTarget ?
        <input type="hidden" name="next" value={redirectTarget} />
      : null}

      <FieldGroup>
        {/* Email */}
        <Field data-invalid={!!formState.errors?.email?.length}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={formState.values?.email}
            disabled={pending}
            required
          />
          {formState.errors?.email && (
            <FieldError>{formState.errors.email[0]}</FieldError>
          )}
        </Field>

        {/* Password */}
        <Field data-invalid={!!formState.errors?.password?.length}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="pr-10"
              defaultValue={formState.values?.password}
              disabled={pending}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ?
                <EyeOff className="size-4" />
              : <Eye className="size-4" />}
            </button>
          </div>
          {formState.errors?.password && (
            <FieldError>{formState.errors.password[0]}</FieldError>
          )}
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={
            redirectTarget ?
              `/signup?next=${encodeURIComponent(redirectTarget)}`
            : "/signup"
          }
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </Form>
  );
}
