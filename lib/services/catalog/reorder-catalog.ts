import { and, eq, gte, gt, inArray, lte, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { books } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth/authorize";
import {
  reorderBooksSchema,
  reorderSlotsSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type ReorderBooksInput,
  type ReorderSlotsInput,
} from "@/lib/validations/catalog";

export type ReorderCatalogSlotsResult = ActionResult<{
  fromSlot: number;
  toSlot: number;
  movedSlotsCount: number;
}>;

export type ReorderBooksResult = ActionResult<{
  orderedIds: string[];
  sequenceOrders: number[];
}>;


/**
 * Reorders catalog slots atomically within a PostgreSQL transaction.
 *
 * Invariants enforced:
 * 1. Moves the whole slot: all books/editions sharing `fromSlot` move together.
 * 2. Contiguity: renumbers all intermediate slots so no gaps or duplicates exist (1..N).
 * 3. Constraint-safe: uses a temporary negative sequence offset to prevent
 *    intermediate unique collisions on `(sequence_order, language)`.
 * 4. ACID: any failure rolls back all slot updates atomically.
 */
export async function reorderCatalogSlots(
  input: ReorderSlotsInput,
): Promise<ReorderCatalogSlotsResult> {
  await requireSuperAdmin();

  const parsed = reorderSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const { fromSlot, toSlot } = parsed.data;

  // No-op if source and destination are the same
  if (fromSlot === toSlot) {
    return {
      ok: true,
      data: {
        fromSlot,
        toSlot,
        movedSlotsCount: 0,
      },
    };
  }

  return await db.transaction(async (tx) => {
    // Determine maximum slot currently in the catalog
    const [stats] = await tx
      .select({
        maxSlot: sql<number>`max(${books.sequenceOrder})`.as("max_slot"),
      })
      .from(books);

    const maxSlot = stats?.maxSlot != null ? Number(stats.maxSlot) : 0;

    if (maxSlot === 0) {
      return {
        ok: false,
        errors: [
          {
            field: "fromSlot",
            message: "Cannot reorder an empty catalog.",
            code: "CATALOG_EMPTY",
          },
        ],
      };
    }

    if (fromSlot > maxSlot) {
      return {
        ok: false,
        errors: [
          {
            field: "fromSlot",
            message: `Source slot ${fromSlot} does not exist. Maximum slot is ${maxSlot}.`,
            code: "SLOT_NOT_FOUND",
          },
        ],
      };
    }

    if (toSlot > maxSlot) {
      return {
        ok: false,
        errors: [
          {
            field: "toSlot",
            message: `Destination slot ${toSlot} is out of bounds. Maximum slot is ${maxSlot}.`,
            code: "SLOT_OUT_OF_BOUNDS",
          },
        ],
      };
    }

    // Ensure fromSlot contains at least one book
    const [fromSlotCheck] = await tx
      .select({ id: books.id })
      .from(books)
      .where(eq(books.sequenceOrder, fromSlot))
      .limit(1);

    if (!fromSlotCheck) {
      return {
        ok: false,
        errors: [
          {
            field: "fromSlot",
            message: `Source slot ${fromSlot} contains no books.`,
            code: "SLOT_EMPTY",
          },
        ],
      };
    }

    // Step 1: Move target slot to a temporary negative slot (-fromSlot)
    // Negative numbers avoid collisions with positive sequence numbers.
    await tx
      .update(books)
      .set({
        sequenceOrder: -fromSlot,
        updatedAt: sql`now()`,
      })
      .where(eq(books.sequenceOrder, fromSlot));

    // Step 2: Shift intermediate slots contiguously
    if (fromSlot > toSlot) {
      // Moving down (e.g. 4 -> 2): slots in [toSlot, fromSlot - 1] shift UP by 1 (2->3, 3->4)
      await tx
        .update(books)
        .set({
          sequenceOrder: sql`${books.sequenceOrder} + 1`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            gte(books.sequenceOrder, toSlot),
            lt(books.sequenceOrder, fromSlot),
          ),
        );
    } else {
      // Moving up (e.g. 2 -> 4): slots in [fromSlot + 1, toSlot] shift DOWN by 1 (3->2, 4->3)
      await tx
        .update(books)
        .set({
          sequenceOrder: sql`${books.sequenceOrder} - 1`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            gt(books.sequenceOrder, fromSlot),
            lte(books.sequenceOrder, toSlot),
          ),
        );
    }

    // Step 3: Move temporary slot (-fromSlot) into target toSlot
    await tx
      .update(books)
      .set({
        sequenceOrder: toSlot,
        updatedAt: sql`now()`,
      })
      .where(eq(books.sequenceOrder, -fromSlot));

    const movedCount = Math.abs(fromSlot - toSlot) + 1;

    return {
      ok: true,
      data: {
        fromSlot,
        toSlot,
        movedSlotsCount: movedCount,
      },
    };
  });
}

/**
 * Reorders curriculum slots from a list of representative book ids.
 *
 * The absolute sequence numbers owned by those slots are preserved and
 * reassigned in ascending order to match `orderedIds` — safe for within-page
 * reordering under server-side pagination.
 */
export async function reorderBooks(
  input: ReorderBooksInput,
): Promise<ReorderBooksResult> {
  await requireSuperAdmin();

  const parsed = reorderBooksSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const { orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    return {
      ok: false,
      errors: [
        {
          field: "orderedIds",
          message: "orderedIds must not contain duplicates.",
          code: "DUPLICATE_IDS",
        },
      ],
    };
  }

  return await db.transaction(async (tx) => {
    const selected = await tx.query.books.findMany({
      where: inArray(books.id, orderedIds),
      columns: {
        id: true,
        sequenceOrder: true,
      },
    });

    if (selected.length !== orderedIds.length) {
      return {
        ok: false,
        errors: [
          {
            field: "orderedIds",
            message: "One or more books were not found.",
            code: "BOOK_NOT_FOUND",
          },
        ],
      };
    }

    const slotById = new Map(
      selected.map((book) => [book.id, book.sequenceOrder] as const),
    );
    const slotsInOrder = orderedIds.map((id) => slotById.get(id)!);

    if (new Set(slotsInOrder).size !== slotsInOrder.length) {
      return {
        ok: false,
        errors: [
          {
            field: "orderedIds",
            message: "Each id must represent a distinct curriculum slot.",
            code: "DUPLICATE_SLOTS",
          },
        ],
      };
    }

    const unchanged = slotsInOrder.every(
      (slot, index, arr) => index === 0 || slot > arr[index - 1]!,
    );
    if (unchanged) {
      return {
        ok: true,
        data: {
          orderedIds,
          sequenceOrders: slotsInOrder,
        },
      };
    }

    const targetOrders = [...slotsInOrder].sort((a, b) => a - b);

    for (let i = 0; i < orderedIds.length; i++) {
      const fromSlot = slotById.get(orderedIds[i]!)!;
      await tx
        .update(books)
        .set({
          sequenceOrder: -(i + 1),
          updatedAt: sql`now()`,
        })
        .where(eq(books.sequenceOrder, fromSlot));
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(books)
        .set({
          sequenceOrder: targetOrders[i]!,
          updatedAt: sql`now()`,
        })
        .where(eq(books.sequenceOrder, -(i + 1)));
    }

    return {
      ok: true,
      data: {
        orderedIds,
        sequenceOrders: targetOrders,
      },
    };
  });
}
