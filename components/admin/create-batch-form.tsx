"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBatchAction } from "@/actions/batch";
import { Button } from "@/components/ui/button";

export function CreateBatchForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [maxMembers, setMaxMembers] = useState(50);
  const [paceGroupCount, setPaceGroupCount] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [pacingType, setPacingType] = useState<"daily" | "three_times_week" | "custom">("daily");
  const [customDays, setCustomDays] = useState(6);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors([]);
    setFieldErrors({});
    setSuccessMessage(null);

    const payload: {
      name: string;
      maxMembers: number;
      paceGroupCount: number;
      startDate: string;
      pacingType: "daily" | "three_times_week" | "custom";
      readingDaysPerWeek?: number;
    } = {
      name,
      maxMembers: Number(maxMembers),
      paceGroupCount: Number(paceGroupCount),
      startDate,
      pacingType,
    };

    if (pacingType === "custom") {
      payload.readingDaysPerWeek = Number(customDays);
    }

    try {
      const res = await createBatchAction(payload);
      if (res.ok) {
        setSuccessMessage(`Batch "${res.data.batch.name}" created successfully! Initial status: Not Yet Open.`);
        setTimeout(() => {
          router.push("/batches");
        }, 1200);
      } else {
        if (res.errors) {
          setFormErrors(res.errors.formErrors || []);
          setFieldErrors(res.errors.fieldErrors || {});
        }
      }
    } catch (err) {
      setFormErrors([(err as Error).message || "An unexpected error occurred."]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
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

      {successMessage && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          {successMessage}
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
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Batch 2026 - Cohort 1"
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
        {fieldErrors.name && (
          <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.name[0]}</p>
        )}
      </div>

      {/* Max Members */}
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
            type="number"
            min="1"
            required
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value))}
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
            type="number"
            min="1"
            required
            value={paceGroupCount}
            onChange={(e) => setPaceGroupCount(Number(e.target.value))}
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
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
        {fieldErrors.startDate && (
          <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.startDate[0]}</p>
        )}
      </div>

      {/* Pacing Type (Epic 12 cadence) */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pacing Type (Cadence)
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label
            className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-all ${
              pacingType === "daily"
                ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="pacingType"
                value="daily"
                checked={pacingType === "daily"}
                onChange={() => setPacingType("daily")}
                className="text-zinc-900 focus:ring-zinc-500"
              />
              <span>Daily</span>
            </div>
            <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              One task step every calendar day
            </span>
          </label>

          <label
            className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-all ${
              pacingType === "three_times_week"
                ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="pacingType"
                value="three_times_week"
                checked={pacingType === "three_times_week"}
                onChange={() => setPacingType("three_times_week")}
                className="text-zinc-900 focus:ring-zinc-500"
              />
              <span>3x Per Week</span>
            </div>
            <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Three ISO weekdays cadence
            </span>
          </label>

          <label
            className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-all ${
              pacingType === "custom"
                ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="pacingType"
                value="custom"
                checked={pacingType === "custom"}
                onChange={() => setPacingType("custom")}
                className="text-zinc-900 focus:ring-zinc-500"
              />
              <span>Custom</span>
            </div>
            <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Batch-specific recurring pace
            </span>
          </label>
        </div>

        {pacingType === "custom" && (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
            <label
              htmlFor="custom-reading-days"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Reading Days Per Week (1–7)
            </label>
            <input
              id="custom-reading-days"
              type="number"
              min="1"
              max="7"
              value={customDays}
              onChange={(e) => setCustomDays(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        )}
        {fieldErrors.pacingType && (
          <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.pacingType[0]}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating Batch..." : "Create Batch"}
        </Button>
      </div>
    </form>
  );
}
