import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  batchDailyTasks,
  books,
  curriculumStepEditions,
  curriculumSteps,
  paceGroups,
} from '@/db/schema';
import { proposeRange } from '@/lib/curriculum/page-math';

export async function resolveTodayTask(paceGroupId: string) {
  const group = await db.query.paceGroups.findFirst({
    where: eq(paceGroups.id, paceGroupId),
  });

  if (!group) {
    throw new Error('Group or active slot not configured');
  }

  const book = await db.query.books.findFirst({
    where: and(
      eq(books.catalogSlotId, group.activeCatalogSlotId),
      eq(books.language, 'en'),
    ),
  });

  if (!book) {
    throw new Error(
      'English edition for the active catalog slot is not configured',
    );
  }

  const lastTask = await db.query.batchDailyTasks.findFirst({
    where: and(
      eq(batchDailyTasks.paceGroupId, paceGroupId),
      eq(batchDailyTasks.publicationStatus, 'published'),
    ),
    orderBy: [desc(batchDailyTasks.batchDayNumber)],
  });

  const lastStep = lastTask
    ? await db.query.curriculumSteps.findFirst({
        where: eq(curriculumSteps.id, lastTask.curriculumStepId),
      })
    : null;

  const nextStepNumber =
    lastStep &&
    lastStep.catalogSlotId === group.activeCatalogSlotId &&
    lastStep.paceSize === group.size
      ? lastStep.stepNumber + 1
      : 1;

  const bankStep = await db.query.curriculumSteps.findFirst({
    where: and(
      eq(curriculumSteps.catalogSlotId, group.activeCatalogSlotId),
      eq(curriculumSteps.paceSize, group.size),
      eq(curriculumSteps.stepNumber, nextStepNumber),
    ),
    orderBy: [desc(curriculumSteps.version)],
  });

  if (bankStep) {
    const stepEdition = await db.query.curriculumStepEditions.findFirst({
      where: and(
        eq(curriculumStepEditions.curriculumStepId, bankStep.id),
        eq(curriculumStepEditions.bookId, book.id),
      ),
    });

    return {
      isPioneer: false,
      stepNumber: nextStepNumber,
      book,
      step: bankStep,
      range: stepEdition
        ? { startPage: stepEdition.startPage, endPage: stepEdition.endPage }
        : null,
      stepEdition,
    };
  }

  if (!book.pageCount) {
    throw new Error('Active book page count is not configured');
  }

  const range = proposeRange({
    cursor: (nextStepNumber - 1) * group.size,
    size: group.size,
    pageCount: book.pageCount,
  });

  return {
    isPioneer: true,
    stepNumber: nextStepNumber,
    book,
    suggestedRange: range,
  };
}
