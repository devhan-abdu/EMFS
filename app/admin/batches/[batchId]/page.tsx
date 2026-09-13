import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Layers, Users } from "lucide-react";

import { PageHeader, StatCard } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RegistrationToggle } from "@/components/admin/registration-toggle";
import { getBatchDetail } from "@/lib/services/batches/batch-detail";
import { getAdminApplicationsWithHandoff } from "@/lib/services/application/admin-handoff";

export const metadata: Metadata = {
  title: "Batch overview — EMFSC Book Shelf Admin",
};

const STALE_AFTER_DAYS = 3;

type BatchDetailPageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function BatchDetailPage({
  params,
}: BatchDetailPageProps) {
  const { batchId } = await params;
  const batch = await getBatchDetail(batchId);
  if (!batch) notFound();

  const applications = await getAdminApplicationsWithHandoff(batchId);
  const pendingCount = applications.filter(
    (a) => a.status === "pending",
  ).length;
  const handoffPending = applications.filter(
    (a) => a.status === "approved_pending_handoff",
  );
  const staleHandoffCount = handoffPending.filter(
    (a) => (a.daysSinceApproved ?? 0) > STALE_AFTER_DAYS,
  ).length;

  return (
    <div className="space-y-8">
      <Link
        href="/admin/batches"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to batches
      </Link>

      <PageHeader
        eyebrow="Batch overview"
        title={batch.name}
        description="Everything you need right after creating a batch — capacity, registration, and who's waiting on you."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Seats filled"
          value={`${batch.enrolled} / ${batch.maxMembers}`}
          hint={`${batch.paceGroupCount} planned pace group(s)`}
        />
        <StatCard
          label="Pending review"
          value={pendingCount}
          hint={
            batch.autoApprove ? "Auto-approve is on" : "Manual review required"
          }
          tone="gold"
        />
        <StatCard
          label="Handoff pending"
          value={handoffPending.length}
          hint={
            staleHandoffCount > 0 ?
              `${staleHandoffCount} stale (3+ days)`
            : "None stale"
          }
          tone={staleHandoffCount > 0 ? "gold" : "teal"}
        />
        <StatCard
          label="Batch admins"
          value={batch.admins.length}
          hint={batch.admins.length === 0 ? "None assigned yet" : undefined}
          tone="teal"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="card-soft lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl">Capacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress
              value={(batch.enrolled / batch.maxMembers) * 100}
              className="h-2"
            />
            <p className="text-sm text-muted-foreground">
              {batch.enrolled} of {batch.maxMembers} seats filled
              {batch.startDate ? ` · starts ${batch.startDate}` : ""}.
            </p>

            <div className="flex items-center justify-between rounded-xl bg-surface-container p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Registration
                </p>
                <p className="text-xs text-muted-foreground">
                  {batch.registrationOpen ?
                    "Open — members can apply now."
                  : "Closed — applicants are routed to the waiting list."}
                </p>
              </div>
              <RegistrationToggle
                batchId={batch.id}
                initialOpen={batch.registrationOpen}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="outline" asChild>
                <Link href={`/admin/members?batch=${batch.id}`}>
                  <Users className="size-4" />
                  Review applications
                  {pendingCount > 0 ? ` (${pendingCount})` : ""}
                </Link>
              </Button>
              <Button variant="outline" disabled>
                <Layers className="size-4" />
                Create pace groups
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl">Batch admins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {batch.admins.length === 0 ?
              <p className="text-sm text-muted-foreground">
                No batch admins assigned yet.
              </p>
            : batch.admins.map((admin) => (
                <div
                  key={admin.profileId}
                  className="flex items-center gap-3 rounded-xl bg-surface-container p-3"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {admin.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {admin.name}
                  </p>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
