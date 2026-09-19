import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  BookOpen,
  ChevronLeft,
  Layers,
  MapPin,
  Pencil,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/shared/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RegistrationToggle } from '@/components/admin/registration-toggle';
import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { getAdminApplicationsWithHandoff } from '@/lib/services/application/admin-handoff';
import { listPaceGroupsForBatch } from '@/lib/services/pace-groups/pace-group';
import { listPaceAdminAssignments } from '@/lib/services/pace-groups/pace-admin-assignment';
import {
  getBatchRoster,
  getPendingMoveRequests,
  getBatchMoveHistory,
} from '@/lib/services/pace-groups/placement';
import { PaceGroupTabs } from '@/components/admin/pace-groups/pace-group-tabs';
import { PaceGroupList } from '@/components/admin/pace-groups/pace-group-list';
import { MemberPlacementSection } from '@/components/admin/pace-groups/member-placement-section';
import { VolunteerRequestsPanel } from '@/components/admin/pace-groups/volunteer-requests-panel';
import { DailyTaskPanel } from '@/components/admin/pace-groups/daily-task-panel';
import type { PaceGroupWithAdmins } from '@/components/admin/pace-groups/types';
import { MetricCard } from '@/components/admin/pace-groups/metric-card';
import { PaceGroupCreateButton } from '@/components/admin/pace-groups/pace-group-create-button';
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
  const description = `Manage ${batch.name} overview, capacity (${batch.enrolled}/${batch.maxMembers} filled), registration windows, pace groups, and batch admin assignments.`;

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
};

export default async function BatchDetailPage({
  params,
}: BatchDetailPageProps) {
  const { batchId } = await params;
  try {
    await requireBatchAccess(batchId);
  } catch (e) {
    if (e instanceof AuthzError) {
      redirect('/admin/batches');
    }
    throw e;
  }

  const batch = await getBatchDetail(batchId);
  if (!batch) notFound();

  const applications = await getAdminApplicationsWithHandoff(batchId);
  const pendingCount = applications.filter(
    (a) => a.status === 'pending',
  ).length;
  const handoffPending = applications.filter(
    (a) => a.status === 'approved_pending_handoff',
  );
  const staleHandoffCount = handoffPending.filter(
    (a) => (a.daysSinceApproved ?? 0) > STALE_AFTER_DAYS,
  ).length;

  const rawGroups = await listPaceGroupsForBatch({
    batchId: batch.id,
    includeArchived: true,
  });
  const groups: PaceGroupWithAdmins[] = await Promise.all(
    rawGroups.map(async (group) => ({
      ...group,
      admins: await listPaceAdminAssignments({ paceGroupId: group.id }),
    })),
  );
  const status = deriveBatchStatus(batch);

  const activeGroups = groups.filter((g) => !g.archived);
  const allAdmins = activeGroups.flatMap((g) => g.admins);
  const groupsWithoutAdmin = activeGroups.filter(
    (g) => g.admins.length === 0,
  ).length;
  const groupsWithDailyTaskDuty = activeGroups.filter((g) =>
    g.admins.some((a) => a.duty === 'daily_task'),
  ).length;

  // --- Live Member Placement & Move History queries ---
  const [rosterSummary, pendingRequests, moveHistory] = await Promise.all([
    getBatchRoster({ batchId: batch.id }),
    getPendingMoveRequests(batch.id),
    getBatchMoveHistory({ batchId: batch.id, page: 1, limit: 20 }),
  ]);
  const awaitingCount = rosterSummary.unplacedCount;
  const assignedCount = rosterSummary.placedCount;

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
        eyebrow={batchStatusLabels[status]}
        title={batch.name}
        description={`${batch.readingDaysPerWeek} reading days a week · starts ${batch.startDate ?? 'to be announced'}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <Button asChild variant="outline" className="gap-1.5">
              <Link href={`/admin/batches/${batch.id}/edit`}>
                <Pencil className="size-4" />
                Edit batch
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Users className="size-5" />}
          label="Members in batch"
          value={`${batch.enrolled} / ${batch.maxMembers}`}
          footer={
            <Progress
              value={(batch.enrolled / batch.maxMembers) * 100}
              className="h-1.5"
            />
          }
        />
        <MetricCard
          icon={<BookOpen className="size-5" />}
          label="Active pace groups"
          value={String(activeGroups.length)}
          footer={
            <p className="text-xs text-muted-foreground">
              {groupsWithDailyTaskDuty} with daily-task duty assigned
            </p>
          }
        />
        <MetricCard
          icon={<ShieldCheck className="size-5" />}
          label="Assigned pace admins"
          value={String(allAdmins.length)}
          footer={
            <p className="text-xs text-muted-foreground">
              {groupsWithoutAdmin} group{groupsWithoutAdmin === 1 ? '' : 's'}{' '}
              with no admin
            </p>
          }
        />
        <MetricCard
          icon={<MapPin className="size-5" />}
          label="Placement"
          value={`${awaitingCount} awaiting`}
          footer={
            <p className="text-xs text-muted-foreground">
              {assignedCount} placed in pace groups
            </p>
          }
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
              {batch.startDate ? ` · starts ${batch.startDate}` : ''}.
            </p>

            <div className="flex items-center justify-between rounded-xl bg-surface-container p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Registration
                </p>
                <p className="text-xs text-muted-foreground">
                  {batch.registrationOpen
                    ? 'Open — members can apply now.'
                    : 'Closed — applicants are routed to the waiting list.'}
                </p>
              </div>
              <RegistrationToggle
                batchId={batch.id}
                initialOpen={batch.registrationOpen}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-xl">Batch admins</CardTitle>
            {/* <BatchAdminAssignButton
              batchId={batch.id}
              existingIds={batch.admins.map((a) => a.profileId)}
            /> */}
          </CardHeader>
          <CardContent className="space-y-3">
            {batch.admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No batch admins assigned yet.
              </p>
            ) : (
              batch.admins.map((admin) => (
                <div
                  key={admin.profileId}
                  className="flex items-center gap-3 rounded-xl bg-surface-container p-3"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {admin.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <p className="flex-1 text-sm font-medium text-foreground">
                    {admin.name}
                  </p>
                  {/* <RemoveBatchAdminButton
                    batchId={batch.id}
                    profileId={admin.profileId}
                  /> */}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div id="pace-groups" className="scroll-mt-20 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            Pacing
          </p>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Pace groups &amp; placement
          </h2>
        </div>

        <PaceGroupTabs
          groupsTab={
            <PaceGroupList batchId={batch.id} initialGroups={groups} />
          }
          membersTab={
            <MemberPlacementSection
              batchId={batch.id}
              batchName={batch.name}
              paceGroups={groups}
              initialRoster={rosterSummary}
              initialPendingRequests={pendingRequests}
              initialHistory={moveHistory}
            />
          }
          volunteersTab={<VolunteerRequestsPanel batchName={batch.name} />}
          tasksTab={<DailyTaskPanel groups={groups} />}
        />
      </div>
    </div>
  );
}
