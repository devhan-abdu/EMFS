import { Minus, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getAdminPaceGroups } from "@/lib/services/admin";
import { Metadata } from "next";

export const metadate: Metadata = {
  title: "Pace groups — EMFSC Book Shelf Admin",
  description:
    "Approve daily page targets, watch group progress and manage pace admins for each EMFSC reading group.",
  openGraph: {
    title: "Pace groups — EMFSC Book Shelf Admin",
    description: "Daily page targets and progress for every reading group.",
  },
};

export default async function PaceGroupsPage() {
  const paceGroups = await getAdminPaceGroups();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily rhythm"
        title="Pace groups"
        description="Approve tomorrow's page target for each group. Small adjustments keep everyone reading together."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {paceGroups.map((group) => {
          const pct = Math.round((group.dayProgress / group.totalDays) * 100);
          return (
            <Card key={group.id} className="card-soft">
              <CardHeader className="space-y-1">
                <CardTitle className="font-display text-xl">
                  {group.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{group.batch}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl bg-surface-container p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Currently reading
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {group.currentBook}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="tabular-nums text-foreground">
                      Day {group.dayProgress} / {group.totalDays}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Tomorrow&apos;s target
                    </p>
                    <p className="font-display text-2xl font-semibold text-foreground">
                      18 pages
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Fewer pages"
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="More pages"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserRound className="size-4" />
                    {group.admin} · {group.members} members
                  </p>
                  <Button
                    size="sm"
                    onClick={() =>
                      toast.success(`Target approved for ${group.name}`)
                    }
                  >
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
