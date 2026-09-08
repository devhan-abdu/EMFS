import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader, StatCard } from "@/components/shared/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getAdminOverviewData } from "@/lib/services/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = {
  title: "Admin Overview — EMFSC Book Shelf",
  description:
    "Track batches, pace groups, applications and reading progress across the EMFSC reading circle.",
  openGraph: {
    title: "Admin Overview — EMFSC Book Shelf",
    description: "Batches, pace groups and reading progress at a glance.",
  },
};

export default async function AdminOverview() {
  const { applications, batches, paceGroups, stats } =
    await getAdminOverviewData();
  const pending = applications.filter((a) => a.status === "pending");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Assalamu alaikum"
        title="The circle at a glance"
        description="Everything happening across EMFSC reading batches today — who is waiting, who is reading, and what comes next."
        actions={
          <Button asChild>
            <Link href="/admin/batches/new">
              Create batch
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active members"
          value={stats.activeMembers}
          hint="Across 2 running batches"
        />
        <StatCard
          label="Pending applications"
          value={stats.pendingApplications}
          hint="Waiting on review"
          tone="gold"
        />
        <StatCard
          label="Reflection rate"
          value="—"
          hint="Weekly submissions"
          tone="teal"
        />
        <StatCard
          label="Attendance"
          value="—"
          hint="Last 7 reading days"
          tone="teal"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="card-soft lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-xl">
              Pace group progress
            </CardTitle>
            <Badge
              variant="secondary"
              className="bg-accent text-accent-foreground"
            >
              Batch 03
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            {paceGroups.map((group) => {
              const pct = Math.round(
                (group.dayProgress / group.totalDays) * 100,
              );
              return (
                <div key={group.id} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        {group.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.currentBook} · {group.members} members ·{" "}
                        {group.admin}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      Day {group.dayProgress} of {group.totalDays}
                    </p>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="card-soft lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-xl">
              Waiting on you
            </CardTitle>
            <Link
              href="/admin/members"
              className="text-sm font-medium text-teal underline-offset-4 hover:underline"
            >
              Review all
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {pending.map((app, i) => (
              <div key={app.id}>
                {i > 0 ?
                  <Separator className="mb-4" />
                : null}
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {app.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {app.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.batch}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-xl bg-surface-container p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="size-4 text-gold" />
                Registration closes in 6 days
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Approve applicants before pace groups are locked so the Telegram
                handoff has time to finish.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-soft">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="font-display text-xl">Batches</CardTitle>
          <Link
            href="/admin/batches"
            className="text-sm font-medium text-teal underline-offset-4 hover:underline"
          >
            Manage batches
          </Link>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {batches.slice(0, 4).map((batch) => (
            <div
              key={batch.id}
              className="rounded-xl border border-border bg-surface-2 p-4 transition-colors hover:border-teal/50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-foreground">{batch.name}</p>
                <StatusBadge
                  status={
                    batch.registrationOpen ? "open"
                    : batch.startDate ?
                      "running"
                    : "draft"
                  }
                />
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {batch.startDate ?? "Start date not set"} · {batch.enrolled}/
                {batch.maxMembers} members
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
