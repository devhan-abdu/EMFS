import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type OpenBatchCardData = {
  id: string;
  name: string;
  startDate: string | null;
  enrolled: number;
  maxMembers: number;
  isFull: boolean;
};

export function OpenBatchCard({ batch }: { batch: OpenBatchCardData }) {
  return (
    <Card className="card-soft">
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="font-display text-xl font-semibold text-foreground">
            {batch.name}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {batch.startDate ?? "Start date to be announced"}
          </p>
        </div>

        <div className="space-y-1.5">
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

        <Button asChild className="w-full">
          <Link
            href={`/signin?next=${encodeURIComponent(`/batches/${batch.id}/apply`)}`}
          >
            {batch.isFull ? "Join waitlist" : "Register"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
