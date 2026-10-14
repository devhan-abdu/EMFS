import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  batchDailyTasks,
  books,
  curriculumStepEditions,
  curriculumSteps,
  paceGroups,
} from '@/db/schema';

export async function createAndPublishPioneerTask(params: {
  paceGroupId: string;
  stepNumber: number;
  caption: string;
  startPage: number;
  endPage: number;
  captionAm?: string;
  imageUrl?: string;
  batchDayNumber: number;
  scheduledDate: string;
}) {
  return await db.transaction(async (tx) => {
    const group = await tx.query.paceGroups.findFirst({
      where: eq(paceGroups.id, params.paceGroupId),
      columns: {
        id: true,
        batchId: true,
        activeCatalogSlotId: true,
        size: true,
      },
    });
    if (!group) throw new Error('Group not found');

    const book = await tx.query.books.findFirst({
      where: and(
        eq(books.catalogSlotId, group.activeCatalogSlotId),
        eq(books.language, 'en'),
      ),
    });
    if (!book) throw new Error('Active English edition not found');

    const [savedStep] = await tx
      .insert(curriculumSteps)
      .values({
        catalogSlotId: group.activeCatalogSlotId,
        paceSize: group.size,
        stepNumber: params.stepNumber,
        imageUrl: params.imageUrl ?? null,
        sourceBatchId: group.batchId,
      })
      .returning();

    const [savedEdition] = await tx
      .insert(curriculumStepEditions)
      .values({
        curriculumStepId: savedStep.id,
        catalogSlotId: group.activeCatalogSlotId,
        bookId: book.id,
        startPage: params.startPage,
        endPage: params.endPage,
        caption: params.caption,
        chapterLabel: params.captionAm ?? null,
      })
      .returning();

    const [publishedPost] = await tx
      .insert(batchDailyTasks)
      .values({
        paceGroupId: group.id,
        curriculumStepId: savedStep.id,
        batchDayNumber: params.batchDayNumber,
        scheduledDate: params.scheduledDate,
        publicationStatus: 'published',
        publishedAt: new Date(),
      })
      .returning();

    return { savedStep, savedEdition, publishedPost };
  });
}
