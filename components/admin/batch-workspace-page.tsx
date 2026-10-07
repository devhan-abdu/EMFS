import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-layout';
import { ApplicationRowActions } from '@/components/admin/application-row-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RegistrationToggle } from '@/components/admin/registration-toggle';
import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { getBatchOverviewData } from '@/lib/services/admin/batch-overview';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  deriveBatchStatus,
  batchStatusLabels,
} from '@/lib/services/batches/batch-status';

export async function generateMetadata({
  params,
}: BatchDetailPageProps): Promise<Metadata> {
  const { batchId } = await params;
  try {
    await requireBatchAccess(batchId);
  } catch {
    return {
      title: 'Batch Not Found — EMFSC Book Shelf Admin',
    };
  }
  const batch = await getBatchDetail(batchId);

  if (!batch) {
    return {
      title: 'Batch Not Found — EMFSC Book Shelf Admin',
    };
  }

  const title = `${batch.name} — EMFSC Book Shelf Admin`;
  const description = `Manage ${batch.name} applications, member placement, and pace group progress.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

const STALE_AFTER_DAYS = 3;

type BatchDetailPageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{
    q?: string;
    search?: string;
    status?: string;
    preference?: string;
    pref?: string;
  }>;
};

export default async function BatchWorkspacePage({
  params,
  searchParams,
}: BatchDetailPageProps) {
  const { batchId } = await params;
  await searchParams;
  let currentUser;
  try {
    currentUser = await requireBatchAccess(batchId);
  } catch (e) {
    if (e instanceof AuthzError) {
      redirect('/admin');
    }
    throw e;
  }

  const { batch, applications, groups, placementStats } =
    await getBatchOverviewData(batchId, currentUser);
  if (!batch) notFound();

  const status = deriveBatchStatus(batch);

  const activeGroups = groups.filter((g) => !g.archived);
  const actionableApplications = applications.filter(
    (application) =>
      application.status === 'pending' ||
      application.status === 'approved_pending_handoff',
  );
  const visibleApplications = actionableApplications.slice(0, 5);
  const pendingVolunteerRequests = 2;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={batchStatusLabels[status]}
        title={batch.name}
        description={`${batch.readingDaysPerWeek} reading days a week · starts ${batch.startDate ?? 'to be announced'}`}
        actions={<StatusBadge status={status} />}
      />

      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            Capacity & registration
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 sm:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {batch.enrolled} of {batch.maxMembers} seats filled
              </p>
              <p className="text-xs text-muted-foreground">
                {placementStats.placed} placed · {placementStats.unplaced}{' '}
                awaiting placement
              </p>
            </div>
            <Progress
              value={(batch.enrolled / batch.maxMembers) * 100}
              className="h-2"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-container p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Registration
              </p>
              <p className="text-xs text-muted-foreground">
                {batch.registrationOpen
                  ? 'Open for applications'
                  : 'Closed to new applications'}
              </p>
            </div>
            <RegistrationToggle
              batchId={batch.id}
              initialOpen={batch.registrationOpen}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="card-soft lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="font-display text-xl">
                Volunteer requests
              </CardTitle>
              <Badge
                variant={pendingVolunteerRequests > 0 ? 'secondary' : 'outline'}
              >
                {pendingVolunteerRequests} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {pendingVolunteerRequests > 0
                ? 'Members are waiting for pace-admin approvals.'
                : 'No volunteer requests are waiting for review.'}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/b/${batch.id}/volunteers`}>
                Review requests
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-soft lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <BookOpen className="size-5" />
                Pace groups
                <Badge variant="outline">{activeGroups.length}</Badge>
              </CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/b/${batch.id}/groups`}>
                  Manage groups
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeGroups.length === 0 ? (
              <p className="rounded-lg bg-surface-container p-4 text-sm text-muted-foreground">
                No active pace groups yet.
              </p>
            ) : (
              activeGroups.map((group) => {
                const hasDailyTaskLead = group.admins.some(
                  (admin) => admin.duty === 'daily_task',
                );
                return (
                  <div
                    key={group.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {group.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Capacity {group.size} · {group.admins.length} pace
                        admins
                      </p>
                    </div>
                    <Badge
                      variant={hasDailyTaskLead ? 'secondary' : 'destructive'}
                      className="w-fit"
                    >
                      {hasDailyTaskLead
                        ? 'Daily-task lead assigned'
                        : 'Needs daily-task lead'}
                    </Badge>
                  </div>
                );
              })
            )}
            <Button asChild size="sm" variant="ghost">
              <Link href={`/admin/b/${batch.id}/tasks`}>
                Review batch progress
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-soft lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <CardTitle className="font-display text-xl">
                  Applications
                </CardTitle>
                <Badge
                  variant={
                    actionableApplications.length > 0 ? 'secondary' : 'outline'
                  }
                >
                  {actionableApplications.length} need attention
                </Badge>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/b/${batch.id}/applications`}>
                  Review all
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleApplications.length === 0 ? (
              <p className="rounded-lg bg-surface-container p-4 text-sm text-muted-foreground">
                Nothing needs attention. New applications and handoff follow-ups
                will appear here.
              </p>
            ) : (
              visibleApplications.map((application) => {
                const staleHandoff =
                  application.status === 'approved_pending_handoff' &&
                  (application.daysSinceApproved ?? 0) > STALE_AFTER_DAYS;
                return (
                  <div
                    key={application.id}
                    className="space-y-3 rounded-lg bg-surface-container p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {application.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {application.email}
                        </p>
                      </div>
                      <Badge
                        variant={
                          staleHandoff
                            ? 'destructive'
                            : application.status === 'pending'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {application.status === 'pending'
                          ? 'Review'
                          : 'Handoff'}
                        {staleHandoff
                          ? ` · ${application.daysSinceApproved}d`
                          : ''}
                      </Badge>
                    </div>
                    <ApplicationRowActions
                      status={application.status}
                      name={application.name}
                      applicationId={application.id}
                      handoffBotLink={application.handoffBotLink}
                    />
                  </div>
                );
              })
            )}
            {actionableApplications.length > visibleApplications.length ? (
              <p className="text-xs text-muted-foreground">
                Showing {visibleApplications.length} of{' '}
                {actionableApplications.length} items needing attention.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
