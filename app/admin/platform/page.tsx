import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BookPlus,
  CalendarDays,
  UserCog,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader, StatCard } from '@/components/shared/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export const metadata: Metadata = {
  title: 'Admin workspaces — EMFSC Book Shelf',
  description: 'Open an authorized batch or pace-group workspace.',
  openGraph: {
    title: 'Admin workspaces — EMFSC Book Shelf',
    description: 'Open an authorized batch or pace-group workspace.',
  },
};

import { requireSuperAdmin } from '@/lib/auth/authorize';
import { getAdminOverviewData } from '@/lib/services/admin';

const lifecycleLabels = {
  draft: 'Draft',
  'registration-open': 'Registration Open',
  started: 'Started',
} as const;

export default async function AdminPlatformOverview() {
  await requireSuperAdmin();
  const { batches, recentBatches, stats, catalog } =
    await getAdminOverviewData();

  const batchesWithoutAdmins = batches.filter(
    (batch) => batch.admins.length === 0,
  );
  const registrationAlerts = batches.filter(
    (batch) => batch.registrationNeedsReview,
  );
  const hasAttentionItems =
    batchesWithoutAdmins.length > 0 ||
    registrationAlerts.length > 0 ||
    stats.catalogBooks === 0;

  return (
    <div className="space-y-8 sm:space-y-10">
      <PageHeader
        eyebrow="Platform"
        title="Super Admin Overview"
        description="System-wide batch health, reader enrollment, and catalog readiness."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/admin/platform/catalog/new">
                <BookPlus className="size-4" />
                Add book
              </Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/platform/batches/new">
                Create batch
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active batches"
          value={stats.activeBatches}
          hint={`${stats.draftBatches} draft · registering or started`}
        />
        <StatCard
          label="Total readers"
          value={stats.totalReaders}
          hint="Active and grace memberships across batches"
          tone="teal"
        />
        <StatCard
          label="Assigned batch admins"
          value={stats.assignedBatchAdmins}
          hint="Unique admins assigned to batches"
          tone="gold"
        />
        <StatCard
          label="Catalog books"
          value={stats.catalogBooks}
          hint="Books in non-archived catalog slots"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* System attention */}
        <Card className="card-soft min-w-0">
          <CardHeader>
            <CardTitle className="font-display text-xl">
              System attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!hasAttentionItems ? (
              <p className="rounded-xl bg-surface-container p-4 text-sm text-muted-foreground">
                No immediate batch or catalog issues.
              </p>
            ) : null}

            {batchesWithoutAdmins.map((batch) => (
              <AttentionItem
                key={`admin-${batch.id}`}
                title={`${batch.name} has no Batch Admin assigned`}
                description="Assign an admin before the batch needs day-to-day management."
                href={`/admin/platform/batches/${batch.id}/edit`}
                actionLabel="Assign admin"
              />
            ))}

            {registrationAlerts.map((batch) => (
              <AttentionItem
                key={`registration-${batch.id}`}
                title={`${batch.name} is scheduled to start with registration closed`}
                description={`Start date: ${batch.startDate}`}
                href={`/admin/platform/batches/${batch.id}/edit`}
                actionLabel="Review batch"
              />
            ))}

            {stats.catalogBooks === 0 ? (
              <AttentionItem
                title="The catalog has no available books."
                href="/admin/platform/catalog/new"
                actionLabel="Add a book"
              />
            ) : null}
          </CardContent>
        </Card>

        {/* Recent catalog additions */}
        <Card className="card-soft min-w-0">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 space-y-0">
            <CardTitle className="font-display text-xl">
              Recent catalog additions
            </CardTitle>
            <Link
              href="/admin/platform/catalog"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Manage catalog
            </Link>
          </CardHeader>
          <CardContent>
            {catalog.recentAdditions.length ? (
              <ul className="divide-y divide-border">
                {catalog.recentAdditions.map((book) => (
                  <li
                    key={book.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {book.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Book {book.sequenceOrder} · {book.language}
                      </p>
                    </div>
                    <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat('en', {
                        dateStyle: 'medium',
                      }).format(book.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl bg-surface-container p-4">
                <p className="text-sm text-muted-foreground">
                  No catalog books have been added yet.
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/admin/platform/catalog/new">Add first book</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Batch portfolio — cards instead of a table */}
      <Card className="card-soft">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 space-y-0">
          <CardTitle className="font-display text-xl">
            Batch portfolio
          </CardTitle>
          <Link
            href="/admin/platform/batches"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Manage all batches
          </Link>
        </CardHeader>
        <CardContent>
          {recentBatches.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recentBatches.map((batch) => {
                const pct =
                  batch.maxMembers > 0
                    ? Math.min(
                        100,
                        Math.round((batch.enrolled / batch.maxMembers) * 100),
                      )
                    : 0;

                return (
                  <div
                    key={batch.id}
                    className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface-2 p-4 transition-colors hover:border-teal/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/admin/b/${batch.id}`}
                        className="min-w-0 break-words font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {batch.name}
                      </Link>
                      <Badge variant="secondary" className="shrink-0">
                        {lifecycleLabels[batch.lifecycleStatus]}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-3.5 shrink-0" />
                        <span className="min-w-0 break-words">
                          {batch.startDate ?? 'Start date not set'}
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <UserCog className="mt-0.5 size-3.5 shrink-0" />
                        <span className="min-w-0 break-words">
                          {batch.admins.length
                            ? batch.admins.join(', ')
                            : 'No admin assigned'}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Users className="size-3.5 shrink-0" />
                          Capacity
                        </span>
                        <span className="tabular-nums">
                          {batch.enrolled} / {batch.maxMembers}
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>

                    <Link
                      href={`/admin/platform/batches/${batch.id}/edit`}
                      className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Settings &amp; admins
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-surface-container p-4">
              <p className="text-sm text-muted-foreground">
                No open or started batches to show yet.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/admin/platform/batches/new">
                  Create first batch
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** One row in "System attention": icon + text on top, action below on mobile, beside on sm+. */
function AttentionItem({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description?: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-container p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-gold" />
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-foreground">
            {title}
          </p>
          {description ? (
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        href={href}
        className="shrink-0 self-start whitespace-nowrap pl-7 text-sm font-medium text-primary underline-offset-4 hover:underline sm:self-auto sm:pl-0"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
