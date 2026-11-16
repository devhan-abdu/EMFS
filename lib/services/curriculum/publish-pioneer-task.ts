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
        min_pages: true,
        max_pages: true,
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

    const pageSpan = params.endPage - params.startPage + 1;
    const isFinalPartialRange = params.endPage === book.pageCount;
    if (
      params.startPage > params.endPage ||
      pageSpan > group.max_pages ||
      (pageSpan < group.min_pages && !isFinalPartialRange)
    ) {
      throw new Error(
        `Task must include between ${group.min_pages} and ${group.max_pages} pages, except for a final partial range.`,
      );
    }

    const [savedStep] = await tx
      .insert(curriculumSteps)
      .values({
        catalogSlotId: group.activeCatalogSlotId,
        paceSize: group.max_pages,
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
