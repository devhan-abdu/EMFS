import { eq, gt, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { books } from "@/db/schema";
import { tasks } from "@/db/schema/tasks";
import { requireSuperAdmin } from "@/lib/auth/authorize";
import {
  deleteFromCloudinary,
  isCloudinaryUrl,
} from "@/lib/services/catalog/cloudinary";
import {
  deleteBookSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type DeleteBookInput,
} from "@/lib/validations/catalog";

export type DeleteBookResult = ActionResult<{
  bookId: string;
  deletedBookIds: string[];
  deletedEditionsCount: number;
  freedSlot: number;
}>;

/**
 * Deletes a curriculum slot: the target book plus every edition sharing its
 * sequenceOrder. Removes related tasks first (FK is ON DELETE RESTRICT),
 * then renumbers higher slots so the sequence stays contiguous.
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
        sequenceOrder: books.sequenceOrder,
      })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!target) {
      return {
        ok: false as const,
        errors: [
          {
            field: "bookId",
            message: "Book was not found.",
            code: "BOOK_NOT_FOUND",
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
      .where(eq(books.sequenceOrder, target.sequenceOrder));

    const ids = slotBooks.map((book) => book.id);
    const coverUrls = slotBooks
      .map((book) => book.coverUrl)
      .filter((url): url is string => Boolean(url));
    const deletedEditionsCount = Math.max(0, ids.length - 1);

    if (ids.length > 0) {
      await tx.delete(tasks).where(inArray(tasks.bookId, ids));

      await tx
        .update(books)
        .set({ pairedBookId: null, updatedAt: sql`now()` })
        .where(inArray(books.id, ids));

      await tx.delete(books).where(inArray(books.id, ids));
    }

    await tx
      .update(books)
      .set({
        sequenceOrder: sql`${books.sequenceOrder} - 1`,
        updatedAt: sql`now()`,
      })
      .where(gt(books.sequenceOrder, target.sequenceOrder));

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
