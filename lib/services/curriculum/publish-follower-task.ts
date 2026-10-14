import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  batchDailyTasks,
  books,
  curriculumSteps,
  paceGroups,
} from '@/db/schema';

export async function publishFollowerTask(params: {
  paceGroupId: string;
  curriculumStepId: string;
  batchDayNumber: number;
  scheduledDate: string;
  localCaptionOverride?: string;
}) {
  const group = await db.query.paceGroups.findFirst({
    where: eq(paceGroups.id, params.paceGroupId),
    columns: { batchId: true, activeCatalogSlotId: true, size: true },
  });
  if (!group) throw new Error('Group not found');

  const [curriculumStep, activeBook] = await Promise.all([
    db.query.curriculumSteps.findFirst({
      where: eq(curriculumSteps.id, params.curriculumStepId),
    }),
    db.query.books.findFirst({
      where: and(
        eq(books.catalogSlotId, group.activeCatalogSlotId),
        eq(books.language, 'en'),
      ),
    }),
  ]);

  if (
    !curriculumStep ||
    !activeBook ||
    curriculumStep.catalogSlotId !== group.activeCatalogSlotId ||
    curriculumStep.paceSize !== group.size
  ) {
    throw new Error('Curriculum step does not match the pace group.');
  }

  const [publishedPost] = await db
    .insert(batchDailyTasks)
    .values({
      paceGroupId: params.paceGroupId,
      curriculumStepId: params.curriculumStepId,
      batchDayNumber: params.batchDayNumber,
      scheduledDate: params.scheduledDate,
      localCaptionOverride: params.localCaptionOverride || null,
      publicationStatus: 'published',
      publishedAt: new Date(),
    })
    .returning();

  return publishedPost;
}
