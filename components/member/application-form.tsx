"use client";

import * as React from "react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitApplicationAction } from "@/actions/application";
import { type FormState } from "@/lib/validations/application";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PACE_GROUP_PREFERENCES } from "@/db/schema/applications";

export function ApplicationForm({
  batchId,
  showPacePreference,
  defaultEmail,
}: {
  batchId: string;
  showPacePreference: boolean;
  defaultEmail?: string;
}) {
  const router = useRouter();

  const initialState: FormState = {
    values: {
      batchId,
      firstName: "",
      fatherName: "",
      grandfatherName: "",
      email: defaultEmail ?? "",
      telegramUsername: "",
      phoneNumber: "",
      paceGroup: showPacePreference ? PACE_GROUP_PREFERENCES[0] : undefined,
    },
    errors: null,
    formError: null,
    success: false,
  };

  const [formState, formAction, pending] = React.useActionState<
    FormState,
    FormData
  >(submitApplicationAction, initialState);

  React.useEffect(() => {
    if (formState.success) {
      toast.success("Application submitted successfully!");

      router.push("/me");
      router.refresh();
    }

    if (formState.formError) {
      toast.error(formState.formError);
    }
  }, [formState.success, formState.formError, batchId, router]);

  return (
    <Form action={formAction} className="space-y-6">
      <input type="hidden" name="batchId" value={batchId} />

      <FieldGroup>
        {/* First name */}
        <Field data-invalid={!!formState.errors?.firstName?.length}>
          <FieldLabel htmlFor="firstName">First name</FieldLabel>

          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={formState.values?.firstName}
            disabled={pending}
            placeholder="First name"
            aria-invalid={!!formState.errors?.firstName?.length}
          />

          {formState.errors?.firstName && (
            <FieldError>{formState.errors.firstName[0]}</FieldError>
          )}
        </Field>

        {/* Father name */}
        <Field data-invalid={!!formState.errors?.fatherName?.length}>
          <FieldLabel htmlFor="fatherName">Father name</FieldLabel>

          <Input
            id="fatherName"
            name="fatherName"
            defaultValue={formState.values?.fatherName}
            disabled={pending}
            placeholder="Father name"
            aria-invalid={!!formState.errors?.fatherName?.length}
          />

          {formState.errors?.fatherName && (
            <FieldError>{formState.errors.fatherName[0]}</FieldError>
          )}
        </Field>

        {/* Grandfather name */}
        <Field data-invalid={!!formState.errors?.grandfatherName?.length}>
          <FieldLabel htmlFor="grandfatherName">Grandfather name</FieldLabel>

          <Input
            id="grandfatherName"
            name="grandfatherName"
            defaultValue={formState.values?.grandfatherName}
            disabled={pending}
            placeholder="Grandfather name"
            aria-invalid={!!formState.errors?.grandfatherName?.length}
          />

          <FieldDescription>Optional</FieldDescription>

          {formState.errors?.grandfatherName && (
            <FieldError>{formState.errors.grandfatherName[0]}</FieldError>
          )}
        </Field>

        {/* Email */}
        <Field data-invalid={!!formState.errors?.email?.length}>
          <FieldLabel htmlFor="email">Email</FieldLabel>

          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={formState.values?.email}
            readOnly
            
          />

          {formState.errors?.email && (
            <FieldError>{formState.errors.email[0]}</FieldError>
          )}
        </Field>

        {/* Telegram */}
        <Field data-invalid={!!formState.errors?.telegramUsername?.length}>
          <FieldLabel htmlFor="telegramUsername">Telegram username</FieldLabel>

          <Input
            id="telegramUsername"
            name="telegramUsername"
            autoComplete="off"
            defaultValue={formState.values?.telegramUsername}
            disabled={pending}
            placeholder="@yourusername"
          />

          {formState.errors?.telegramUsername && (
            <FieldError>{formState.errors.telegramUsername[0]}</FieldError>
          )}
        </Field>

        {/* Phone */}
        <Field data-invalid={!!formState.errors?.phoneNumber?.length}>
          <FieldLabel htmlFor="phoneNumber">Phone number</FieldLabel>

          <Input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            autoComplete="tel"
            defaultValue={formState.values?.phoneNumber}
            disabled={pending}
            placeholder="0911234567"
          />

          {formState.errors?.phoneNumber && (
            <FieldError>{formState.errors.phoneNumber[0]}</FieldError>
          )}
        </Field>

        {/* Pace */}
        {showPacePreference && (
          <Field data-invalid={!!formState.errors?.paceGroup?.length}>
            <FieldLabel htmlFor="paceGroup">Pace preference</FieldLabel>

            <Select
              name="paceGroup"
              defaultValue={formState.values?.paceGroup}
              disabled={pending}
            >
              <SelectTrigger id="paceGroup" className="w-full">
                <SelectValue placeholder="Select pace preference" />
              </SelectTrigger>

              <SelectContent>
                {PACE_GROUP_PREFERENCES.map((pace) => (
                  <SelectItem key={pace} value={pace}>
                    {pace} pages / day
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <FieldDescription>
              This is a preference, not a placement. An admin confirms your
              group after activation.
            </FieldDescription>

            {formState.errors?.paceGroup && (
              <FieldError>{formState.errors.paceGroup[0]}</FieldError>
            )}
          </Field>
        )}
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting..." : "Submit application"}
      </Button>
    </Form>
  );
}
