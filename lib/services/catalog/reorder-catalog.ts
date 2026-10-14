import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { books, catalogSlots } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/auth/authorize';
import {
  reorderBooksSchema,
  reorderSlotsSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type ReorderBooksInput,
  type ReorderSlotsInput,
} from '@/lib/validations/catalog';

export type ReorderCatalogSlotsResult = ActionResult<{
  fromSlot: number;
  toSlot: number;
  movedSlotsCount: number;
}>;

export type ReorderBooksResult = ActionResult<{
  orderedIds: string[];
  sequenceOrders: number[];
}>;

export async function reorderCatalogSlots(
  input: ReorderSlotsInput,
): Promise<ReorderCatalogSlotsResult> {
  await requireSuperAdmin();

  const parsed = reorderSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const { fromSlot, toSlot } = parsed.data;
  if (fromSlot === toSlot) {
    return {
      ok: true,
      data: { fromSlot, toSlot, movedSlotsCount: 0 },
    };
  }

  return db.transaction(async (tx) => {
    const [stats] = await tx
      .select({ maxSlot: sql<number>`max(${catalogSlots.sequenceOrder})` })
      .from(catalogSlots)
      .where(eq(catalogSlots.archived, false));
    const maxSlot = Number(stats?.maxSlot ?? 0);

    if (maxSlot === 0) {
      return {
        ok: false,
        errors: [
          {
            field: 'fromSlot',
            message: 'Cannot reorder an empty catalog.',
            code: 'CATALOG_EMPTY',
          },
        ],
      };
    }

    if (fromSlot > maxSlot) {
      return {
        ok: false,
        errors: [
          {
            field: 'fromSlot',
            message: `Source slot ${fromSlot} does not exist. Maximum slot is ${maxSlot}.`,
            code: 'SLOT_NOT_FOUND',
          },
        ],
      };
    }

    if (toSlot > maxSlot) {
      return {
        ok: false,
        errors: [
          {
            field: 'toSlot',
            message: `Destination slot ${toSlot} is out of bounds. Maximum slot is ${maxSlot}.`,
            code: 'SLOT_OUT_OF_BOUNDS',
          },
        ],
      };
    }

    const [source] = await tx
      .select({ id: catalogSlots.id })
      .from(catalogSlots)
      .where(
        and(
          eq(catalogSlots.sequenceOrder, fromSlot),
          eq(catalogSlots.archived, false),
        ),
      )
      .limit(1);

    if (!source) {
      return {
        ok: false,
        errors: [
          {
            field: 'fromSlot',
            message: `Source slot ${fromSlot} contains no active book.`,
            code: 'SLOT_EMPTY',
          },
        ],
      };
    }

    // Move the selected slot out of the occupied range, then shift into its gap.
    const temporaryOrder = maxSlot + 1;
    await tx
      .update(catalogSlots)
      .set({ sequenceOrder: temporaryOrder, updatedAt: sql`now()` })
      .where(eq(catalogSlots.id, source.id));

    if (fromSlot > toSlot) {
      for (let order = fromSlot - 1; order >= toSlot; order--) {
        await tx
          .update(catalogSlots)
          .set({ sequenceOrder: order + 1, updatedAt: sql`now()` })
          .where(eq(catalogSlots.sequenceOrder, order));
      }
    } else {
      for (let order = fromSlot + 1; order <= toSlot; order++) {
        await tx
          .update(catalogSlots)
          .set({ sequenceOrder: order - 1, updatedAt: sql`now()` })
          .where(eq(catalogSlots.sequenceOrder, order));
      }
    }

    await tx
      .update(catalogSlots)
      .set({ sequenceOrder: toSlot, updatedAt: sql`now()` })
      .where(eq(catalogSlots.id, source.id));

    return {
      ok: true,
      data: {
        fromSlot,
        toSlot,
        movedSlotsCount: Math.abs(fromSlot - toSlot) + 1,
      },
    };
  });
}

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
          field: 'orderedIds',
          message: 'orderedIds must not contain duplicates.',
          code: 'DUPLICATE_IDS',
        },
      ],
    };
  }

  return db.transaction(async (tx) => {
    const selected = await tx
      .select({
        bookId: books.id,
        catalogSlotId: books.catalogSlotId,
        sequenceOrder: catalogSlots.sequenceOrder,
      })
      .from(books)
      .innerJoin(catalogSlots, eq(catalogSlots.id, books.catalogSlotId))
      .where(inArray(books.id, orderedIds));

    if (selected.length !== orderedIds.length) {
      return {
        ok: false,
        errors: [
          {
            field: 'orderedIds',
            message: 'One or more books were not found.',
            code: 'BOOK_NOT_FOUND',
          },
        ],
      };
    }

    const slotByBookId = new Map(
      selected.map((book) => [book.bookId, book.catalogSlotId] as const),
    );
    const orderBySlotId = new Map(
      selected.map((book) => [book.catalogSlotId, book.sequenceOrder] as const),
    );
    const orderedSlotIds = orderedIds.map((id) => slotByBookId.get(id)!);

    if (new Set(orderedSlotIds).size !== orderedSlotIds.length) {
      return {
        ok: false,
        errors: [
          {
            field: 'orderedIds',
            message: 'Each id must represent a distinct catalog slot.',
            code: 'DUPLICATE_SLOTS',
          },
        ],
      };
    }

    const currentOrders = orderedSlotIds.map((slotId) =>
      orderBySlotId.get(slotId)!,
    );
    const unchanged = currentOrders.every(
      (order, index) => index === 0 || order > currentOrders[index - 1]!,
    );
    if (unchanged) {
      return {
        ok: true,
        data: { orderedIds, sequenceOrders: currentOrders },
      };
    }

    const targetOrders = [...currentOrders].sort((a, b) => a - b);
    const [stats] = await tx
      .select({ maxSlot: sql<number>`max(${catalogSlots.sequenceOrder})` })
      .from(catalogSlots);
    const temporaryBase = Number(stats?.maxSlot ?? 0) + 1;

    for (let index = 0; index < orderedSlotIds.length; index++) {
      await tx
        .update(catalogSlots)
        .set({ sequenceOrder: temporaryBase + index, updatedAt: sql`now()` })
        .where(eq(catalogSlots.id, orderedSlotIds[index]!));
    }

    for (let index = 0; index < orderedSlotIds.length; index++) {
      await tx
        .update(catalogSlots)
        .set({ sequenceOrder: targetOrders[index]!, updatedAt: sql`now()` })
        .where(eq(catalogSlots.id, orderedSlotIds[index]!));
    }

    return {
      ok: true,
      data: { orderedIds, sequenceOrders: targetOrders },
    };
  });
}
