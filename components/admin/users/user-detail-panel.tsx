'use client';

import * as React from 'react';
import Link from 'next/link';
import { Clock, History, Mail, Phone, Send, Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { dutyLabels } from '@/components/admin/pace-groups/duty-labels';
import type { UserDetails } from '@/lib/services/admin/user-management';

function formatDisplayDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function RoleBadge({ role, isSuper }: { role: string; isSuper: boolean }) {
  if (isSuper) {
    return (
      <Badge variant="default" className="bg-gold text-gold-foreground">
        Super Admin
      </Badge>
    );
  }
  if (role === 'batch_admin') {
    return (
      <Badge variant="default" className="bg-teal text-teal-foreground">
        Batch Admin
      </Badge>
    );
  }
  if (role === 'pace_admin') {
    return (
      <Badge
        variant="secondary"
        className="border-teal/30 bg-teal/10 text-teal"
      >
        Pace Admin
      </Badge>
    );
  }
  return <Badge variant="outline">Member</Badge>;
}

export function UserDetailPanel({
  open,
  onOpenChange,
  userDetails,
  isLoading,
  onChangeRoleClick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userDetails: UserDetails | null;
  isLoading?: boolean;
  onChangeRoleClick: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-6 sm:max-w-xl"
      >
        <SheetHeader className="space-y-2 border-b border-border pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="text-xl">
                {isLoading ? 'Loading profile...' : userDetails?.profile.name}
              </SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-2">
                {userDetails ? (
                  <>
                    <RoleBadge
                      role={userDetails.profile.role}
                      isSuper={userDetails.profile.isSuperAdmin}
                    />
                    <span>·</span>
                    <span className="text-xs text-muted-foreground">
                      Joined {formatDisplayDate(userDetails.profile.createdAt)}
                    </span>
                  </>
                ) : null}
              </SheetDescription>
            </div>
            {userDetails ? (
              <Button size="sm" onClick={onChangeRoleClick}>
                <Shield className="size-4" />
                Change Role
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 py-8 text-center text-sm text-muted-foreground">
            <p>Loading user details and responsibilities...</p>
          </div>
        ) : !userDetails ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>No user selected.</p>
          </div>
        ) : (
          <div className="space-y-8 py-4">
            {/* Contact & Identity Info */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Account Information
              </h3>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface-container p-4 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate text-foreground font-medium">
                    {userDetails.profile.email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Send className="size-3.5 shrink-0" />
                  {userDetails.profile.telegramLinked ? (
                    <span className="text-teal font-medium">
                      @{userDetails.profile.telegramUsername}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Telegram Unlinked
                    </span>
                  )}
                </div>
                {userDetails.profile.phone ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" />
                    <span className="text-foreground">
                      {userDetails.profile.phone}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" />
                  <span>
                    Updated {formatDisplayDate(userDetails.profile.updatedAt)}
                  </span>
                </div>
              </div>
            </section>

            {/* Scope Summary */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Administrative Responsibilities
              </h3>
              <div className="rounded-lg border border-border bg-surface-container p-4">
                <p className="text-sm font-medium text-foreground">
                  {userDetails.scopeSummary.summaryText}
                </p>
              </div>
            </section>

            {/* Batches Administered */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Batches Administered
                </h3>
                <Badge variant="secondary">
                  {userDetails.batchAdminAssignments.length}
                </Badge>
              </div>
              {userDetails.batchAdminAssignments.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-2 p-4 text-xs text-muted-foreground">
                  Not currently assigned as a Batch Admin for any batches.
                </p>
              ) : (
                <div className="space-y-2">
                  {userDetails.batchAdminAssignments.map((batch) => (
                    <div
                      key={batch.batchId}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {batch.batchName}
                        </p>
                        <p className="text-muted-foreground">
                          {batch.startDate
                            ? `Starts ${batch.startDate}`
                            : 'Start date not set'}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/b/${batch.batchId}`}>
                          Open Workspace
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pace Groups Administered */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Pace Groups Administered
                </h3>
                <Badge variant="secondary">
                  {userDetails.paceAdminAssignments.length}
                </Badge>
              </div>
              {userDetails.paceAdminAssignments.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-2 p-4 text-xs text-muted-foreground">
                  Not currently assigned as a Pace Admin for any pace groups.
                </p>
              ) : (
                <div className="space-y-2">
                  {userDetails.paceAdminAssignments.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-start justify-between rounded-lg border border-border bg-surface-2 p-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {group.paceGroupName}
                          </p>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">
                            {group.batchName}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge variant="outline" className="text-teal">
                            {dutyLabels[group.duty]}
                          </Badge>
                          {group.assignedBookTitle ? (
                            <span className="text-muted-foreground">
                              Book: {group.assignedBookTitle}
                            </span>
                          ) : null}
                        </div>
                        {group.notes ? (
                          <p className="text-muted-foreground italic">
                            Note: {group.notes}
                          </p>
                        ) : null}
                      </div>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/g/${group.paceGroupId}`}>
                          Open Group
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Program Memberships */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Participant Memberships
              </h3>
              {userDetails.memberships.batchMemberships.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-2 p-4 text-xs text-muted-foreground">
                  No participant memberships found.
                </p>
              ) : (
                <div className="space-y-2">
                  {userDetails.memberships.batchMemberships.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3 text-xs"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {m.batchName}
                        </p>
                        <p className="text-muted-foreground">
                          Enrolled {formatDisplayDate(m.enrolledAt)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          m.status === 'active' ? 'default' : 'secondary'
                        }
                        className="capitalize"
                      >
                        {m.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Role Change History Audit */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="size-4 text-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Role Change Audit History
                </h3>
              </div>

              {userDetails.roleHistory.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-2 p-4 text-xs text-muted-foreground">
                  No role change records recorded for this user.
                </p>
              ) : (
                <div className="space-y-3">
                  {userDetails.roleHistory.map((log) => (
                    <div
                      key={log.id}
                      className="space-y-2 rounded-lg border border-border bg-surface-container p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {log.previousRole} → {log.newRole}
                        </span>
                        <time className="text-muted-foreground">
                          {formatDisplayDate(log.createdAt)}
                        </time>
                      </div>

                      <p className="text-muted-foreground">
                        Changed by{' '}
                        <span className="text-foreground">{log.actorName}</span>
                      </p>

                      {log.assignmentChanges ? (
                        <div className="space-y-1 rounded border border-border/50 bg-background/50 p-2 text-muted-foreground">
                          {log.assignmentChanges.batchesAdded?.map((b) => (
                            <p key={b.id} className="text-teal">
                              + Added Batch: {b.name || b.id}
                            </p>
                          ))}
                          {log.assignmentChanges.batchesRemoved?.map((b) => (
                            <p key={b.id} className="text-destructive">
                              - Removed Batch: {b.name || b.id}
                            </p>
                          ))}
                          {log.assignmentChanges.paceGroupsAdded?.map(
                            (p, i) => (
                              <p key={i} className="text-teal">
                                + Added Pace Group: {p.name} ({p.duty})
                              </p>
                            ),
                          )}
                          {log.assignmentChanges.paceGroupsRemoved?.map(
                            (p, i) => (
                              <p key={i} className="text-destructive">
                                - Removed Pace Group: {p.name}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}

                      {log.reason ? (
                        <p className="italic text-muted-foreground">
                          Reason: {log.reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
