import { ReactNode } from "react";

import { Lotus } from "@/components/brand/lotus";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rise-in md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-semibold text-foreground md:text-[2.5rem] md:leading-tight">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "navy",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "navy" | "teal" | "gold";
}) {
  const toneRing = {
    navy: "bg-primary/10",
    teal: "bg-teal/15",
    gold: "bg-gold/20",
  }[tone];

  return (
    <div className="card-soft relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 size-28 rounded-full blur-[2px]",
          toneRing,
        )}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-14 text-center">
      <Lotus className="h-12 w-12 text-primary/25" />
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}