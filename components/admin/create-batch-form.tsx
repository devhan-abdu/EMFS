"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createBatchAction } from "@/actions/batch";
import { Button } from "@/components/ui/button";

export function CreateBatchForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createBatchAction, null);

  const formErrors = state?.errors?.formErrors ?? [];
  const fieldErrors = state?.errors?.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Create New Batch
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create a fully configured not-yet-open batch. Reading will conceptually start from catalog sequence 1.
        </p>
      </div>

      {formErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <ul className="list-inside list-disc space-y-1">
            {formErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Batch Name */}
      <div className="space-y-1.5">
        <label
          htmlFor="batch-name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Batch Name
        </label>
        <input
          id="batch-name"
          name="name"
          type="text"
          required
          placeholder="e.g. Batch 2026 - Cohort 1"
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
        {fieldErrors.name && (
          <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.name[0]}</p>
        )}
      </div>

      {/* Max Members & Pace Group Count */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="max-members"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Max Members (Capacity)
          </label>
          <input
            id="max-members"
            name="maxMembers"
            type="number"
            min="1"
            required
            defaultValue={50}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
          />
          {fieldErrors.maxMembers && (
            <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.maxMembers[0]}</p>
          )}
        </div>

        {/* Planned Pace Group Count */}
        <div className="space-y-1.5">
          <label
            htmlFor="pace-group-count"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Planned Pace Group Count (≥ 1)
          </label>
          <input
            id="pace-group-count"
            name="paceGroupCount"
            type="number"
            min="1"
            required
            defaultValue={1}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
          />
          {fieldErrors.paceGroupCount && (
            <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.paceGroupCount[0]}</p>
          )}
        </div>
      </div>

      {/* Start Date */}
      <div className="space-y-1.5">
        <label
          htmlFor="start-date"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Start Date
        </label>
        <input
          id="start-date"
          name="startDate"
          type="date"
          required
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
        {fieldErrors.startDate && (
          <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.startDate[0]}</p>
        )}
      </div>

      {/* Reading Days Per Week */}
      <div className="space-y-1.5">
        <label
          htmlFor="reading-days"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Reading Days Per Week (1–7)
        </label>
        <input
          id="reading-days"
          name="readingDaysPerWeek"
          type="number"
          min="1"
          max="7"
          required
          defaultValue={6}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Defaults to 6 days per week. Controls cohort reading schedule cadence.
        </p>
        {fieldErrors.readingDaysPerWeek && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.readingDaysPerWeek[0]}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
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
