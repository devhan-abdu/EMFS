"use client";

import * as React from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { signUpAction } from "@/actions/auth";
import { type SignUpFormState } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

export function SignUpForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = next ?? searchParams.get("next") ?? "/";

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const initialState: SignUpFormState = {
    values: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    errors: null,
    formError: null,
    success: false,
  };

  const [formState, formAction, pending] = React.useActionState<
    SignUpFormState,
    FormData
  >(signUpAction, initialState);

  React.useEffect(() => {
    if (formState.success) {
      toast.success("Account created successfully!");
      router.push(redirectTarget);
      router.refresh();
    } else if (formState.formError) {
      toast.error(formState.formError);
    }
  }, [formState.success, formState.formError, redirectTarget, router]);

  return (
    <Form action={formAction} className="mt-8 space-y-5">
      {next ?
        <input type="hidden" name="next" value={next} />
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
              autoComplete="new-password"
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

        {/* Confirm Password */}
        <Field data-invalid={!!formState.errors?.confirmPassword?.length}>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <div className="relative">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-10"
              defaultValue={formState.values?.confirmPassword}
              disabled={pending}
              required
            />
            <button
              type="button"
              aria-label={
                showConfirmPassword ?
                  "Hide confirmed password"
                : "Show confirmed password"
              }
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showConfirmPassword ?
                <EyeOff className="size-4" />
              : <Eye className="size-4" />}
            </button>
          </div>
          {formState.errors?.confirmPassword && (
            <FieldError>{formState.errors.confirmPassword[0]}</FieldError>
          )}
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={next ? `/signin?next=${encodeURIComponent(next)}` : "/signin"}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </Form>
  );
}
