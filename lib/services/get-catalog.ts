import { asc, count, countDistinct, inArray } from "drizzle-orm";

import { db } from "@/db";
import { books } from "@/db/schema";
import {
  getCatalogSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type GetCatalogInput,
} from "@/lib/validations/catalog";

export type CatalogBookItem = {
  id: string;
  title: string;
  language: string;
  author: string | null;
  coverUrl: string | null;
  sequenceOrder: number;
  pairedBookId: string | null;
  createdAt: Date;
  updatedAt: Date;
  pairedBook?: {
    id: string;
    title: string;
    language: string;
    author: string | null;
    coverUrl: string | null;
  } | null;
  tasksCount?: number;
};

export type CatalogSlotGroup = {
  slot: number;
  editions: CatalogBookItem[];
};

export type PaginatedCatalogResult = {
  slots: CatalogSlotGroup[];
  books: CatalogBookItem[];
  pagination: {
    page: number;
    limit: number;
    totalSlots: number;
    totalBooks: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

/**
 * Reads catalog entries with pagination and deterministic, stable ordering.
 *
 * Ordering strategy:
 * - Primary: `sequenceOrder ASC` (groups editions by curriculum slot)
 * - Secondary: `language ASC` (deterministic edition order within the slot)
 * - Tertiary: `id ASC` (immutable tie-breaker)
 *
 * Pagination is computed over program slots, fetching only the required slots
 * and their associated language editions.
 */
export async function getCatalog(
  input?: GetCatalogInput,
): Promise<ActionResult<PaginatedCatalogResult>> {
  const parsed = getCatalogSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  // 1. Get total counts (total editions & distinct slots)
  const [stats] = await db
    .select({
      totalBooks: count(books.id),
      totalSlots: countDistinct(books.sequenceOrder),
    })
    .from(books);

  const totalBooks = stats?.totalBooks ? Number(stats.totalBooks) : 0;
  const totalSlots = stats?.totalSlots ? Number(stats.totalSlots) : 0;
  const totalPages = Math.max(1, Math.ceil(totalSlots / limit));

  if (totalSlots === 0) {
    return {
      ok: true,
      data: {
        slots: [],
        books: [],
        pagination: {
          page,
          limit,
          totalSlots: 0,
          totalBooks: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    };
  }

  // 2. Fetch distinct sequence_order slots for the requested page
  const pageSlotRows = await db
    .selectDistinct({
      sequenceOrder: books.sequenceOrder,
    })
    .from(books)
    .orderBy(asc(books.sequenceOrder))
    .limit(limit)
    .offset(offset);

  const slotNumbers = pageSlotRows.map((r) => r.sequenceOrder);

  if (slotNumbers.length === 0) {
    return {
      ok: true,
      data: {
        slots: [],
        books: [],
        pagination: {
          page,
          limit,
          totalSlots,
          totalBooks,
          totalPages,
          hasNextPage: false,
          hasPrevPage: page > 1,
        },
      },
    };
  }

  // 3. Fetch all book editions in these slots with relations
  const pageBooks = await db.query.books.findMany({
    where: inArray(books.sequenceOrder, slotNumbers),
    orderBy: [asc(books.sequenceOrder), asc(books.language), asc(books.id)],
    with: {
      pairedBook: {
        columns: {
          id: true,
          title: true,
          language: true,
          author: true,
          coverUrl: true,
        },
      },
      tasks: {
        columns: {
          id: true,
        },
      },
    },
  });

  const formattedBooks: CatalogBookItem[] = pageBooks.map((b) => ({
    id: b.id,
    title: b.title,
    language: b.language,
    author: b.author,
    coverUrl: b.coverUrl,
    sequenceOrder: b.sequenceOrder,
    pairedBookId: b.pairedBookId,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    pairedBook: b.pairedBook ?? null,
    tasksCount: b.tasks?.length ?? 0,
  }));

  // 4. Group into slots
  const slotsMap = new Map<number, CatalogBookItem[]>();
  for (const slot of slotNumbers) {
    slotsMap.set(slot, []);
  }

  for (const book of formattedBooks) {
    const list = slotsMap.get(book.sequenceOrder);
    if (list) {
      list.push(book);
    }
  }

  const slots: CatalogSlotGroup[] = slotNumbers.map((slot) => ({
    slot,
    editions: slotsMap.get(slot) ?? [],
  }));

  return {
    ok: true,
    data: {
      slots,
      books: formattedBooks,
      pagination: {
        page,
        limit,
        totalSlots,
        totalBooks,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  };
}
