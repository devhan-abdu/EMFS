import { Search } from 'lucide-react';

import { EmptyState, PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  AdminApplicationWithHandoff,
  ApplicationHandoffStatus,
} from '@/lib/services/admin/application-handoff';
import { ApplicationRowActions } from '@/components/admin/application-row-actions';

const STALE_AFTER_DAYS = 3;

const tabs: { value: ApplicationHandoffStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved_pending_handoff', label: 'Handoff pending' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'Everyone' },
];

function statusClass(status: ApplicationHandoffStatus, stale: boolean): string {
  const classes: Record<ApplicationHandoffStatus, string> = {
    pending: 'bg-gold/20 text-gold-foreground border-gold/30',
    approved_pending_handoff: stale
      ? 'bg-destructive/10 text-destructive border-destructive/30'
      : 'bg-gold/20 text-gold-foreground border-gold/30',
    active: 'bg-teal/15 text-teal-foreground border-teal/30',
    rejected: 'bg-muted text-muted-foreground border-border',
  };

  return classes[status];
}

function statusLabel(status: ApplicationHandoffStatus): string {
  const labels: Record<ApplicationHandoffStatus, string> = {
    pending: 'Pending',
    approved_pending_handoff: 'Handoff pending',
    active: 'Active',
    rejected: 'Rejected',
  };
  return labels[status];
}

export function ApplicationManagementView({
  applications,
  title,
  description,
}: {
  applications: AdminApplicationWithHandoff[];
  title: string;
  description: string;
}) {
  return (
    // min-w-0 + max-w-full: stops this block from growing wider than its parent
    <div className="min-w-0 max-w-full space-y-8">
      <PageHeader
        eyebrow="Intake"
        title={title}
        description={description}
        actions={
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email"
              className="w-full pl-10"
            />
          </div>
        }
      />

      <Tabs defaultValue="pending" className="min-w-0 space-y-6">
        <div className="max-w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-max bg-surface-container">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="shrink-0 whitespace-nowrap"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((tab) => {
          const rows =
            tab.value === 'all'
              ? applications
              : applications.filter((a) => a.status === tab.value);

          return (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="min-w-0 space-y-4"
            >
              {rows.length === 0 ? (
                <EmptyState
                  title="Nothing here yet"
                  description="When sisters apply to an open batch, they'll appear here for review."
                />
              ) : (
                <>
                  {/* Desktop / tablet: table scrolls inside the card */}
                  <Card className="card-soft hidden max-w-full overflow-hidden p-0 md:block">
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[760px]">
                        <TableHeader>
                          <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
                            <TableHead className="py-4 pl-6">
                              Applicant
                            </TableHead>
                            <TableHead>Batch</TableHead>
                            <TableHead>Applied</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="pr-6 text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((app) => {
                            const stale =
                              app.status === 'approved_pending_handoff' &&
                              (app.daysSinceApproved ?? 0) > STALE_AFTER_DAYS;
                            return (
                              <TableRow
                                key={app.id}
                                className="hover:bg-accent/40"
                              >
                                <TableCell className="py-4 pl-6">
                                  <div className="flex items-center gap-4">
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                                      {app.name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .join('')}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="whitespace-nowrap font-medium text-foreground">
                                        {app.name}
                                      </p>
                                      <p className="whitespace-nowrap text-xs text-muted-foreground">
                                        {app.email}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                  {app.batch}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                  {app.appliedOn}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass(app.status, stale)}`}
                                  >
                                    {statusLabel(app.status)}
                                    {stale
                                      ? ` · ${app.daysSinceApproved}d`
                                      : ''}
                                  </span>
                                </TableCell>
                                <TableCell className="pr-6 text-right">
                                  <ApplicationRowActions
                                    status={app.status}
                                    name={app.name}
                                    applicationId={app.id}
                                    handoffBotLink={app.handoffBotLink}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>

                  {/* Mobile: stacked cards, text wraps instead of overflowing */}
                  <div className="min-w-0 space-y-4 md:hidden">
                    {rows.map((app) => {
                      const stale =
                        app.status === 'approved_pending_handoff' &&
                        (app.daysSinceApproved ?? 0) > STALE_AFTER_DAYS;
                      return (
                        <Card
                          key={app.id}
                          className="card-soft max-w-full overflow-hidden"
                        >
                          <CardContent className="space-y-4 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-foreground">
                                  {app.name}
                                </p>
                                <p className="break-all text-xs text-muted-foreground">
                                  {app.email}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass(app.status, stale)}`}
                              >
                                {statusLabel(app.status)}
                                {stale ? ` · ${app.daysSinceApproved}d` : ''}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {app.batch} · applied {app.appliedOn}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <ApplicationRowActions
                                status={app.status}
                                name={app.name}
                                applicationId={app.id}
                                handoffBotLink={app.handoffBotLink}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
