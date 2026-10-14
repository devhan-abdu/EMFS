import { asc, count, countDistinct, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { books, catalogSlots, curriculumSteps } from '@/db/schema';
import {
  getCatalogSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type GetCatalogInput,
} from '@/lib/validations/catalog';

export type CatalogBookItem = {
  id: string;
  title: string;
  language: string;
  author: string | null;
  coverUrl: string | null;
  summary: string | null;
  pageCount: number | null;
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
    /** Slots per page (alias of limit). */
    pageSize: number;
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
 * Paginates by distinct `sequenceOrder` slots (curriculum order), not raw
 * book rows — so paired editions stay together on the same page.
 * Cover URLs are stored as absolute HTTPS values (Cloudinary or Google Books).
 */
export async function getCatalog(
  input?: GetCatalogInput,
): Promise<ActionResult<PaginatedCatalogResult>> {
  const parsed = getCatalogSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const { page, limit, pageSize } = parsed.data;
  const offset = (page - 1) * limit;

  const [stats] = await db
    .select({
      totalBooks: count(books.id),
      totalSlots: countDistinct(catalogSlots.id),
    })
    .from(catalogSlots)
    .leftJoin(books, eq(books.catalogSlotId, catalogSlots.id))
    .where(eq(catalogSlots.archived, false));

  const totalBooks = stats?.totalBooks ? Number(stats.totalBooks) : 0;
  const totalSlots = stats?.totalSlots ? Number(stats.totalSlots) : 0;
  const totalPages = Math.max(1, Math.ceil(totalSlots / limit));

  const emptyPagination = {
    page,
    pageSize,
    limit,
    totalSlots: 0,
    totalBooks: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  if (totalSlots === 0) {
    return {
      ok: true,
      data: {
        slots: [],
        books: [],
        pagination: emptyPagination,
      },
    };
  }

  const pageSlotRows = await db
    .selectDistinct({
      id: catalogSlots.id,
      sequenceOrder: catalogSlots.sequenceOrder,
    })
    .from(catalogSlots)
    .where(eq(catalogSlots.archived, false))
    .orderBy(asc(catalogSlots.sequenceOrder))
    .limit(limit)
    .offset(offset);

  const slotIds = pageSlotRows.map((row) => row.id);
  const orderBySlotId = new Map(
    pageSlotRows.map((row) => [row.id, row.sequenceOrder]),
  );

  const paginationBase = {
    page,
    pageSize,
    limit,
    totalSlots,
    totalBooks,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };

  if (slotIds.length === 0) {
    return {
      ok: true,
      data: {
        slots: [],
        books: [],
        pagination: {
          ...paginationBase,
          hasNextPage: false,
        },
      },
    };
  }

  const curriculumStepCounts = await db
    .select({
      catalogSlotId: curriculumSteps.catalogSlotId,
      count: count(curriculumSteps.id),
    })
    .from(curriculumSteps)
    .where(inArray(curriculumSteps.catalogSlotId, slotIds))
    .groupBy(curriculumSteps.catalogSlotId);
  const countBySlot = new Map(
    curriculumStepCounts.map((row) => [row.catalogSlotId, row.count]),
  );

  const pageBooks = await db.query.books.findMany({
    where: inArray(books.catalogSlotId, slotIds),
    orderBy: [asc(books.language), asc(books.id)],
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
    },
  });

  const formattedBooks: CatalogBookItem[] = pageBooks.map((b) => ({
    id: b.id,
    title: b.title,
    language: b.language,
    author: b.author,
    coverUrl: b.coverUrl,
    summary: b.summary,
    pageCount: b.pageCount,
    sequenceOrder: orderBySlotId.get(b.catalogSlotId) ?? 0,
    pairedBookId: b.pairedBookId,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    pairedBook: b.pairedBook
      ? {
          ...b.pairedBook,
          coverUrl: b.pairedBook.coverUrl,
        }
      : null,
    tasksCount: countBySlot.get(b.catalogSlotId) ?? 0,
  }));

  const slotsMap = new Map<string, CatalogBookItem[]>();
  const slotIdByBookId = new Map(
    pageBooks.map((book) => [book.id, book.catalogSlotId]),
  );
  for (const slotId of slotIds) {
    slotsMap.set(slotId, []);
  }

  for (const book of formattedBooks) {
    const list = slotsMap.get(slotIdByBookId.get(book.id) ?? '');
    if (list) {
      list.push(book);
    }
  }

  const slots: CatalogSlotGroup[] = pageSlotRows.map((slot) => ({
    slot: slot.sequenceOrder,
    editions: slotsMap.get(slot.id) ?? [],
  }));

  return {
    ok: true,
    data: {
      slots,
      books: formattedBooks,
      pagination: paginationBase,
    },
  };
}
