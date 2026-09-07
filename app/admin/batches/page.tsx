import { CalendarDays, Plus, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminBatches } from "@/lib/services/admin";

import type { Metadata } from "next";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = {
  title: "Batches — EMFSC Book Shelf Admin",
  description:
    "Create and manage EMFSC reading batches, cohort capacity, pace groups and registration windows.",
  openGraph: {
    title: "Batches — EMFSC Book Shelf Admin",
    description: "Manage reading cohorts, capacity and registration windows.",
  },
};
export default async function BatchesPage() {
  const batches = await getAdminBatches();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cohorts"
        title="Batches"
        description="Each batch holds its own pace groups, capacity and reading rhythm. Registration can open before pace groups or pace admins are assigned."
        actions={
          <Button asChild>
            <Link href="/admin/batches/new">
              <Plus className="size-4" />
              Create batch
            </Link>
          </Button>
        }
      />

      {/* Desktop table */}
      <Card className="card-soft hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
              <TableHead className="py-4 pl-6">Batch</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Pace groups</TableHead>
              <TableHead>Start date</TableHead>
              <TableHead>Reading days</TableHead>
              <TableHead className="pr-6 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.id} className="hover:bg-accent/40">
                <TableCell className="py-4 pl-6">
                  <p className="font-medium text-foreground">{batch.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {batch.admins.length ?
                      batch.admins.join(", ")
                    : "No batch admin assigned"}
                  </p>
                </TableCell>
                <TableCell className="w-44">
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {batch.enrolled} / {batch.maxMembers}
                  </p>
                  <Progress
                    value={(batch.enrolled / batch.maxMembers) * 100}
                    className="mt-1.5 h-1.5"
                  />
                </TableCell>
                <TableCell className="tabular-nums">
                  {batch.paceGroupCount}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {batch.startDate ?? "Not set"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {batch.readingDaysPerWeek} / week
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <StatusBadge
                    status={
                      batch.registrationOpen ? "open"
                      : batch.startDate ?
                        "running"
                      : "draft"
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-4 md:hidden">
        {batches.map((batch) => (
          <Card key={batch.id} className="card-soft">
            <CardContent className="space-y-3 p-5">
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
              <Progress
                value={(batch.enrolled / batch.maxMembers) * 100}
                className="h-1.5"
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {batch.enrolled}/{batch.maxMembers} · {batch.paceGroupCount}{" "}
                  pace groups
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  {batch.startDate ?? "Not set"} · {batch.readingDaysPerWeek}{" "}
                  days/wk
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
