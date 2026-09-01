"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createBatchAction } from "@/actions/batch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPicker } from "@/components/admin/admin-picker";

export function CreateBatchForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createBatchAction, null);

  const formErrors = state?.errors?.formErrors ?? [];
  const fieldErrors = state?.errors?.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-xs text-card-foreground"
    >
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Create New Batch
        </h2>
        <p className="text-sm text-muted-foreground">
          Create a fully configured not-yet-open batch. Reading will conceptually start from catalog sequence 1.
        </p>
      </div>

      {formErrors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          <ul className="list-inside list-disc space-y-2">
            {formErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Batch Name */}
      <div className="space-y-2">
        <label
          htmlFor="batch-name"
          className="block text-sm font-medium text-foreground"
        >
          Batch Name
        </label>
        <Input
          id="batch-name"
          name="name"
          type="text"
          required
          placeholder="e.g. Batch 2026 - Cohort 1"
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
        )}
      </div>

      {/* Max Members & Pace Group Count */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="max-members"
            className="block text-sm font-medium text-foreground"
          >
            Max Members (Capacity)
          </label>
          <Input
            id="max-members"
            name="maxMembers"
            type="number"
            min="1"
            required
            defaultValue={50}
          />
          {fieldErrors.maxMembers && (
            <p className="text-xs text-destructive">{fieldErrors.maxMembers[0]}</p>
          )}
        </div>

        {/* Planned Pace Group Count */}
        <div className="space-y-2">
          <label
            htmlFor="pace-group-count"
            className="block text-sm font-medium text-foreground"
          >
            Planned Pace Group Count (≥ 1)
          </label>
          <Input
            id="pace-group-count"
            name="paceGroupCount"
            type="number"
            min="1"
            required
            defaultValue={1}
          />
          {fieldErrors.paceGroupCount && (
            <p className="text-xs text-destructive">{fieldErrors.paceGroupCount[0]}</p>
          )}
        </div>
      </div>

      {/* Start Date */}
      <div className="space-y-2">
        <label
          htmlFor="start-date"
          className="block text-sm font-medium text-foreground"
        >
          Start Date
        </label>
        <Input
          id="start-date"
          name="startDate"
          type="date"
          required
        />
        {fieldErrors.startDate && (
          <p className="text-xs text-destructive">{fieldErrors.startDate[0]}</p>
        )}
      </div>

      {/* Reading Days Per Week */}
      <div className="space-y-2">
        <label
          htmlFor="reading-days"
          className="block text-sm font-medium text-foreground"
        >
          Reading Days Per Week (1–7)
        </label>
        <Input
          id="reading-days"
          name="readingDaysPerWeek"
          type="number"
          min="1"
          max="7"
          required
          defaultValue={6}
        />
        <p className="text-xs text-muted-foreground">
          Defaults to 6 days per week. Controls cohort reading schedule cadence.
        </p>
        {fieldErrors.readingDaysPerWeek && (
          <p className="text-xs text-destructive">
            {fieldErrors.readingDaysPerWeek[0]}
          </p>
        )}
      </div>

      {/* Batch Admins Picker (1–3 Admins) */}
      <AdminPicker error={fieldErrors.adminIds?.[0]} />

      <div className="flex justify-end gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating Batch..." : "Create Batch"}
        </Button>
      </div>
    </form>
  );
}
