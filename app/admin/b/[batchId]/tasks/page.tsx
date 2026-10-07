import { notFound } from 'next/navigation';
import { BookOpen, CalendarClock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-layout';
import { requireBatchAccess } from '@/lib/auth/authorize';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { listPaceGroupsForBatch } from '@/lib/services/pace-groups/pace-group';
import { resolveTodayTask } from '@/lib/services/curriculum/resolve-today-task';

export default async function BatchTasksPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  await requireBatchAccess(batchId);

  const [batch, groups] = await Promise.all([
    getBatchDetail(batchId),
    listPaceGroupsForBatch({ batchId, includeArchived: true }),
  ]);

  if (!batch) notFound();

  const groupSummaries = await Promise.all(
    groups.map(async (group) => {
      try {
        const nextTask = await resolveTodayTask(group.id);
        return {
          groupId: group.id,
          groupName: group.name,
          nextTask,
        };
      } catch {
        return {
          groupId: group.id,
          groupName: group.name,
          nextTask: null,
        };
      }
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch progress"
        description={`${batch.name} · task publishing and reading-day rhythm`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groupSummaries.map(({ groupName, nextTask }) => (
          <Card key={groupName} className="card-soft">
            <CardHeader>
              <CardTitle className="font-display text-lg">
                {groupName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground">
                <CalendarClock className="size-4" />
                {nextTask ? (
                  <span>
                    {nextTask.isPioneer ? 'Pioneer step' : 'Follower step'} ·
                    {` ${nextTask.stepNumber}`}
                  </span>
                ) : (
                  <span>Task not yet resolved</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="size-4" />
                {nextTask?.range ? (
                  <span>
                    Pages {nextTask.range.startPage}–{nextTask.range.endPage}
                  </span>
                ) : (
                  <span>Awaiting book or curriculum setup</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
