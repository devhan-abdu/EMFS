import { asc, eq, gt, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  batchDailyTasks,
  books,
  catalogSlots,
  curriculumSteps,
  editionPageAnchors,
  memberSlotEditions,
  paceGroups,
} from '@/db/schema';
import { requireSuperAdmin } from '@/lib/auth/authorize';
import {
  deleteFromCloudinary,
  isCloudinaryUrl,
} from '@/lib/services/catalog/cloudinary';
import {
  deleteBookSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type DeleteBookInput,
} from '@/lib/validations/catalog';

export type DeleteBookResult = ActionResult<{
  bookId: string;
  deletedBookIds: string[];
  deletedEditionsCount: number;
  freedSlot: number;
}>;

export type ArchiveCatalogSlotResult = ActionResult<{
  catalogSlotId: string;
  sequenceOrder: number;
}>;

/**
 * Deletes an unused catalog slot and its editions. Referenced slots are blocked
 * so curriculum, scheduled tasks, and progress history remain intact.
 */
export async function deleteBook(
  input: DeleteBookInput,
): Promise<DeleteBookResult> {
  await requireSuperAdmin();

  const parsed = deleteBookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const { bookId } = parsed.data;
  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        id: books.id,
        catalogSlotId: books.catalogSlotId,
        sequenceOrder: catalogSlots.sequenceOrder,
      })
      .from(books)
      .innerJoin(catalogSlots, eq(catalogSlots.id, books.catalogSlotId))
      .where(eq(books.id, bookId))
      .limit(1);

    if (!target) {
      return {
        ok: false as const,
        errors: [
          {
            field: 'bookId',
            message: 'Book was not found.',
            code: 'BOOK_NOT_FOUND',
          },
        ],
      };
    }

    const slotBooks = await tx
      .select({
        id: books.id,
        coverUrl: books.coverUrl,
      })
      .from(books)
      .where(eq(books.catalogSlotId, target.catalogSlotId));

    const ids = slotBooks.map((book) => book.id);
    const coverUrls = slotBooks
      .map((book) => book.coverUrl)
      .filter((url): url is string => Boolean(url));
    const deletedEditionsCount = Math.max(0, ids.length - 1);

    const [curriculumReference] = await tx
      .select({ id: curriculumSteps.id })
      .from(curriculumSteps)
      .where(eq(curriculumSteps.catalogSlotId, target.catalogSlotId))
      .limit(1);
    const [taskReference] = await tx
      .select({ id: batchDailyTasks.id })
      .from(batchDailyTasks)
      .innerJoin(
        curriculumSteps,
        eq(curriculumSteps.id, batchDailyTasks.curriculumStepId),
      )
      .where(eq(curriculumSteps.catalogSlotId, target.catalogSlotId))
      .limit(1);
    const [groupReference] = await tx
      .select({ id: paceGroups.id })
      .from(paceGroups)
      .where(eq(paceGroups.activeCatalogSlotId, target.catalogSlotId))
      .limit(1);
    const [memberEditionReference] = await tx
      .select({ id: memberSlotEditions.id })
      .from(memberSlotEditions)
      .where(eq(memberSlotEditions.catalogSlotId, target.catalogSlotId))
      .limit(1);

    if (
      curriculumReference ||
      taskReference ||
      groupReference ||
      memberEditionReference
    ) {
      return {
        ok: false as const,
        errors: [
          {
            field: 'bookId',
            message:
              'This slot is referenced by curriculum, a pace group, or member edition history. Archive it instead of deleting it.',
            code: 'SLOT_IN_USE',
          },
        ],
      };
    }

    await tx
      .delete(editionPageAnchors)
      .where(inArray(editionPageAnchors.editionBookId, ids));
    await tx
      .update(books)
      .set({ pairedBookId: null, updatedAt: sql`now()` })
      .where(inArray(books.id, ids));
    await tx.delete(books).where(inArray(books.id, ids));
    await tx
      .delete(catalogSlots)
      .where(eq(catalogSlots.id, target.catalogSlotId));

    const followingSlots = await tx
      .select({
        id: catalogSlots.id,
        sequenceOrder: catalogSlots.sequenceOrder,
      })
      .from(catalogSlots)
      .where(gt(catalogSlots.sequenceOrder, target.sequenceOrder))
      .orderBy(asc(catalogSlots.sequenceOrder));

    for (const slot of followingSlots) {
      await tx
        .update(catalogSlots)
        .set({ sequenceOrder: slot.sequenceOrder - 1, updatedAt: sql`now()` })
        .where(eq(catalogSlots.id, slot.id));
    }

    return {
      ok: true as const,
      data: {
        bookId,
        deletedBookIds: ids,
        deletedEditionsCount,
        freedSlot: target.sequenceOrder,
        coverUrls,
      },
    };
  });

  if (result.ok) {
    await Promise.all(
      result.data.coverUrls
        .filter(isCloudinaryUrl)
        .map((url) => deleteFromCloudinary(url).catch(() => undefined)),
    );

    const { coverUrls: _covers, ...data } = result.data;
    return { ok: true, data };
  }

  return result;
}

export async function archiveCatalogSlot(input: {
  bookId: string;
}): Promise<ArchiveCatalogSlotResult> {
  await requireSuperAdmin();

  const parsed = deleteBookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const [target] = await db
    .select({
      catalogSlotId: catalogSlots.id,
      sequenceOrder: catalogSlots.sequenceOrder,
      archived: catalogSlots.archived,
    })
    .from(books)
    .innerJoin(catalogSlots, eq(catalogSlots.id, books.catalogSlotId))
    .where(eq(books.id, parsed.data.bookId))
    .limit(1);

  if (!target) {
    return {
      ok: false,
      errors: [
        {
          field: 'bookId',
          message: 'Book was not found.',
          code: 'BOOK_NOT_FOUND',
        },
      ],
    };
  }

  if (!target.archived) {
    await db
      .update(catalogSlots)
      .set({ archived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(catalogSlots.id, target.catalogSlotId));
  }

  return {
    ok: true,
    data: {
      catalogSlotId: target.catalogSlotId,
      sequenceOrder: target.sequenceOrder,
    },
  };
}
