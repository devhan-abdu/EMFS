import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { OpenBatchCardData } from "@/components/batches/open-batch-card";

export function FeaturedBatchCard({ batch }: { batch: OpenBatchCardData }) {
  return (
    <div className="card-soft rounded-2xl border border-border bg-card p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
        Now registering
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-foreground md:text-3xl">
        {batch.name}
      </h2>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="size-4" />
        {batch.startDate ?? "Start date to be announced"}
      </p>

      <div className="mt-5 max-w-xs space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Seats filled</span>
          <span className="tabular-nums">
            {batch.enrolled} / {batch.maxMembers}
          </span>
        </div>
        <Progress
          value={(batch.enrolled / batch.maxMembers) * 100}
          className="h-1.5"
        />
      </div>

      <Button size="lg" asChild className="mt-6">
        <Link
          href={`/signin?next=${encodeURIComponent(`/batches/${batch.id}/apply`)}`}
        >
          {batch.isFull ? "Join waitlist" : "Register now"}
        </Link>
      </Button>
    </div>
  );
}
