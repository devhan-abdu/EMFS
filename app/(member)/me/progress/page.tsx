import type { Metadata } from "next";
import { Check, Flame, X } from "lucide-react";

import { StatCard } from "@/components/shared/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = {
  title: "My progress — EMFSC Book Shelf",
  description: "Pages read, reflections, attendance and streak in one place.",
  openGraph: {
    title: "My progress — EMFSC Book Shelf",
    description: "Pages read, reflections, attendance and streak in one place.",
  },
};

// Local UI Placeholders
const memberStats = {
  pagesRead: 140,
  totalPages: 320,
  reflectionsWritten: 4,
  reflectionsExpected: 5,
  streak: 7,
  attendance: 85,
};

const todayReading = {
  batch: "Batch 4 · Seerah",
  book: "The Sealed Nectar",
  paceGroup: "5 pages/day",
};

const readingLog = [
  { date: "Today, Oct 24", pages: "135 - 140", status: "done" },
  { date: "Yesterday, Oct 23", pages: "130 - 134", status: "done" },
  { date: "Oct 22", pages: "125 - 129", status: "missed" },
  { date: "Oct 21", pages: "120 - 124", status: "done" },
  { date: "Oct 20", pages: "115 - 119", status: "done" },
];

export default function ProgressPage() {
  const pagePct = Math.round(
    (memberStats.pagesRead / memberStats.totalPages) * 100,
  );

  return (
    <div className="space-y-8">
      <div className="rise-in space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
          {todayReading.batch}
        </p>
        <h1 className="font-display text-3xl font-semibold text-foreground md:text-[2.5rem] md:leading-tight">
          My progress
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Not a scoreboard — just a mirror. Missed days are part of it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Pages read"
          value={memberStats.pagesRead}
          hint={`of ${memberStats.totalPages} in ${todayReading.book}`}
        />
        <StatCard
          label="Reflections"
          value={`${memberStats.reflectionsWritten}/${memberStats.reflectionsExpected}`}
          hint="Every week so far, masha Allah"
          tone="teal"
        />
        <StatCard
          label="Current streak"
          value={`${memberStats.streak} days`}
          hint="Longest this batch"
          tone="gold"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-soft">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl">
              Book progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-4xl font-semibold text-foreground">
                {pagePct}%
              </p>
              <p className="text-sm text-muted-foreground">
                {memberStats.totalPages - memberStats.pagesRead} pages left
              </p>
            </div>
            <Progress value={pagePct} className="h-2" />
            <p className="text-sm text-muted-foreground">
              At today's pace you'll finish with your group.
            </p>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl">Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-4xl font-semibold text-foreground">
                {memberStats.attendance}%
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-medium text-gold-foreground">
                <Flame className="size-3.5" />
                {memberStats.streak} days
              </span>
            </div>
            <Progress value={memberStats.attendance} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Weekly meet-ups attended with {todayReading.paceGroup}.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Recent days
        </h2>
        <Card className="card-soft divide-y divide-border p-0">
          {readingLog.map((entry) => (
            <div
              key={entry.date}
              className="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div>
                <p className="font-medium text-foreground">{entry.date}</p>
                <p className="text-xs text-muted-foreground">
                  Pages {entry.pages}
                </p>
              </div>
              {entry.status === "done" ?
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/15 px-3 py-1 text-xs font-medium text-teal-foreground">
                  <Check className="size-3.5" />
                  Read
                </span>
              : <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  <X className="size-3.5" />
                  Missed
                </span>
              }
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
