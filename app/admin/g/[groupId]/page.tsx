import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/db';
import { batches, paceGroups } from '@/db/schema';
import {
  AuthzError,
  getAuthorizedBatchIds,
  requirePaceGroupAccess,
} from '@/lib/auth/authorize';
import { listPaceAdminAssignments } from '@/lib/services/admin/pace-admin-assignment';
import { eq } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Pace-group workspace — EMFSC Book Shelf Admin',
};

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function PaceGroupWorkspacePage({ params }: Props) {
  const { groupId } = await params;
  let currentUser;
  try {
    currentUser = await requirePaceGroupAccess(groupId);
  } catch (error) {
    if (error instanceof AuthzError) redirect('/admin');
    throw error;
  }

  const [group] = await db
    .select({
      id: paceGroups.id,
      name: paceGroups.name,
      batchId: batches.id,
      batchName: batches.name,
      size: paceGroups.size,
      archived: paceGroups.archived,
    })
    .from(paceGroups)
    .innerJoin(batches, eq(batches.id, paceGroups.batchId))
    .where(eq(paceGroups.id, groupId))
    .limit(1);

  if (!group) notFound();

  const [assignments, authorizedBatchIds] = await Promise.all([
    listPaceAdminAssignments({ paceGroupId: group.id }),
    getAuthorizedBatchIds(currentUser),
  ]);
  const canOpenBatch =
    currentUser.profile.isSuperAdmin ||
    authorizedBatchIds === 'all' ||
    authorizedBatchIds.includes(group.batchId);

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/admin" className="underline-offset-4 hover:underline">
              Workspaces
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            {canOpenBatch ? (
              <Link
                href={`/admin/b/${group.batchId}`}
                className="underline-offset-4 hover:underline"
              >
                {group.batchName}
              </Link>
            ) : (
              group.batchName
            )}
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {group.name}
          </li>
        </ol>
      </nav>

      <PageHeader
        eyebrow={
          group.archived ? 'Archived pace group' : 'Pace-group workspace'
        }
        title={group.name}
        description={`${group.batchName} · capacity ${group.size}`}
      />

      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            Pace-group assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignments.length ? (
            assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {assignment.profile.fullName ?? assignment.profile.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {assignment.profile.email}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {assignment.duty.replace('_', ' ')}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No pace-admin assignments are recorded for this group.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
