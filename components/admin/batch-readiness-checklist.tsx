"use client";

import {
  Check,
  AlertCircle,
  Circle,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { BatchReadiness } from "@/lib/services/admin";

type Props = {
  readiness: BatchReadiness;
};

type ChecklistItem = {
  label: string;
  met: boolean;
  /** Optional neutral status — registration closed is not a failure, just unchecked. */
  neutral?: boolean;
  detail: string;
};

function buildChecklist(r: BatchReadiness): ChecklistItem[] {
  const d = r.details;
  return [
    {
      label: "Book catalog",
      met: r.catalog_ready,
      detail:
        r.catalog_ready
          ? `Catalog ready (${d.catalogBooksCount} ${d.catalogBooksCount === 1 ? "book" : "books"})`
          : "No books in catalog",
    },
    {
      label: "Batch admins",
      met: r.batch_admins_assigned,
      detail:
        r.batch_admins_assigned
          ? `${d.assignedBatchAdminCount} batch ${d.assignedBatchAdminCount === 1 ? "admin" : "admins"} assigned`
          : `Needs 1–3 batch admins (${d.assignedBatchAdminCount} assigned)`,
    },
    {
      label: "Pace groups",
      met: r.pace_groups_ready,
      detail:
        r.pace_groups_ready
          ? `${d.actualPaceGroupCount}/${d.plannedPaceGroupCount} pace groups created`
          : `${d.actualPaceGroupCount}/${d.plannedPaceGroupCount} pace groups created`,
    },
    {
      label: "Pace admins",
      met: r.pace_admins_assigned,
      detail:
        r.pace_admins_assigned
          ? "All pace groups have admins"
          : d.actualPaceGroupCount === 0
            ? "No pace groups exist yet"
            : `${d.paceGroupsWithoutAdminCount} group${d.paceGroupsWithoutAdminCount === 1 ? "" : "s"} missing pace admin`,
    },
    {
      label: "Schedule & pacing",
      met: r.pacing_confirmed,
      detail:
        r.pacing_confirmed
          ? [
              `Starts ${d.startDate}`,
              d.paceGroupPaces.length === 1
                ? `${d.paceGroupPaces[0]} pages/day`
                : `${d.paceGroupPaces.join("/")} pages/day`,
              `${d.readingDaysPerWeek} days/wk`,
            ].join(" · ")
          : "Start date or pace group daily target not set",
    },
    {
      label: "Registration",
      met: r.registration_open,
      neutral: !r.registration_open,
      detail: r.registration_open ? "Registration open" : "Registration closed",
    },
  ];
}

function ItemIcon({ met, neutral }: { met: boolean; neutral?: boolean }) {
  if (met) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (neutral) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center">
        <Circle className="size-3.5 text-muted-foreground" />
      </span>
    );
  }
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      <AlertCircle className="size-3.5 text-destructive" />
    </span>
  );
}

export function BatchReadinessChecklist({ readiness }: Props) {
  const { score, total, isReady } = readiness;
  const checklist = buildChecklist(readiness);

  return (
    <Popover>
      <PopoverTrigger>
        <button
          id={`readiness-trigger-${score}-${total}`}
          type="button"
          aria-label={`Readiness: ${score} of ${total} checks passed`}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {isReady ? (
            <ShieldCheck className="size-3.5 text-primary" />
          ) : (
            <ClipboardList className="size-3.5 text-muted-foreground" />
          )}
          <span className={isReady ? "text-primary" : "text-foreground"}>
            {score}/{total}
          </span>
          <span className="text-muted-foreground">
            {isReady ? "Ready" : "Incomplete"}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="w-80 p-0"
      >
        {/* Header */}
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            Setup checklist
          </p>
          <p className="text-xs text-muted-foreground">
            {score} of {total} requirements met
          </p>
        </div>

        {/* Items */}
        <ul className="divide-y divide-border">
          {checklist.map((item) => (
            <li
              key={item.label}
              className="flex items-start gap-3 px-4 py-3"
            >
              <ItemIcon met={item.met} neutral={item.neutral} />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-medium leading-none ${item.met ? "text-foreground" : item.neutral ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {item.label}
                </p>
                <p
                  className={`mt-1 text-xs leading-snug ${item.met ? "text-muted-foreground" : item.neutral ? "text-muted-foreground" : "text-destructive"}`}
                >
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer score */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Overall readiness
            </span>
            <Badge variant={isReady ? "default" : "secondary"}>
              {isReady ? "Ready to launch" : `${score}/${total} complete`}
            </Badge>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
