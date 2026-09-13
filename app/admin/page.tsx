import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader, StatCard } from "@/components/shared/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const { applications, batches, paceGroups, stats, catalog } =
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
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Approve applicants before pace groups are locked so the Telegram
                handoff has time to finish.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4" aria-labelledby="catalog-report-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">
              Operations report
            </p>
            <h2
              id="catalog-report-title"
              className="font-display text-2xl font-semibold text-foreground"
            >
              Catalog health
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Review incomplete entries before the next batch starts.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="card-soft">
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Catalog slots
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {stats.catalogSlots}
              </p>
              <p className="text-xs text-muted-foreground">
                Distinct program positions
              </p>
            </CardContent>
          </Card>
          <Card className="card-soft">
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Language gaps
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {catalog.editionCoverageGaps.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Slots with one edition
              </p>
            </CardContent>
          </Card>
          <Card className="card-soft">
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Curriculum gaps
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {catalog.curriculumGaps.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Editions with no tasks
              </p>
            </CardContent>
          </Card>
          <Card className="card-soft">
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Orphaned uploads
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {catalog.orphanedUploadCount ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {catalog.orphanedUploadCount === null ?
                  "Cloudinary unavailable"
                : "Not linked to a book"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-soft">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-xl">
                Recent additions
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Latest catalog rows requiring a quick completeness check.
              </p>
            </div>
            <Badge variant="outline">Last 5</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalog.recentAdditions.length > 0 ?
                  catalog.recentAdditions.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell className="w-full min-w-[300px] font-medium text-foreground">
                        {book.title}
                      </TableCell>

                      <TableCell className="whitespace-nowrap tabular-nums">
                        {book.sequenceOrder}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {book.language}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                        {book.createdAt.toISOString().slice(0, 10)}
                      </TableCell>
                    </TableRow>
                  ))
                : <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No books added yet.
                    </TableCell>
                  </TableRow>
                }
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="card-soft">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="font-display text-xl">
                  Edition coverage
                </CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Slots missing a language edition.
                </p>
              </div>
              <Badge
                variant={
                  catalog.editionCoverageGaps.length > 0 ?
                    "destructive"
                  : "secondary"
                }
              >
                {catalog.editionCoverageGaps.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slot</TableHead>
                    <TableHead className="text-right">Editions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.editionCoverageGaps.length > 0 ?
                    catalog.editionCoverageGaps.map((gap) => (
                      <TableRow key={gap.sequenceOrder}>
                        <TableCell className="font-medium">
                          Slot {gap.sequenceOrder}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {gap.editionCount} / 2
                        </TableCell>
                      </TableRow>
                    ))
                  : <TableRow>
                      <TableCell
                        colSpan={2}
                        className="h-20 text-center text-muted-foreground"
                      >
                        No coverage gaps.
                      </TableCell>
                    </TableRow>
                  }
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="card-soft">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="font-display text-xl">
                  Curriculum coverage
                </CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Editions with no attached tasks.
                </p>
              </div>
              <Badge
                variant={
                  catalog.curriculumGaps.length > 0 ?
                    "destructive"
                  : "secondary"
                }
              >
                {catalog.curriculumGaps.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Edition</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead className="text-right">Tasks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.curriculumGaps.length > 0 ?
                    catalog.curriculumGaps.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell className="max-w-0 truncate font-medium">
                          Slot {book.sequenceOrder} · {book.title}
                        </TableCell>
                        <TableCell>{book.language}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {book.tasksCount}
                        </TableCell>
                      </TableRow>
                    ))
                  : <TableRow>
                      <TableCell
                        colSpan={3}
                        className="h-20 text-center text-muted-foreground"
                      >
                        No curriculum gaps.
                      </TableCell>
                    </TableRow>
                  }
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

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
