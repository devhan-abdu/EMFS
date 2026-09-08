"use server";

import {
  AuthzError,
  authzErrorToFieldError,
  requireSuperAdmin,
} from "@/lib/auth/authorize";
import {
  addPairedEditionWithCover,
  createBookWithCover,
  updateBookWithCover,
} from "@/lib/services/catalog/create-book";
import { deleteBook, type DeleteBookResult } from "@/lib/services/catalog/delete-book";
import {
  getCatalog,
  type PaginatedCatalogResult,
} from "@/lib/services/catalog/get-catalog";
import { searchGoogleBooks } from "@/lib/services/catalog/google-books";
import {
  reorderBooks,
  reorderCatalogSlots,
} from "@/lib/services/catalog/reorder-catalog";
import {
  reorderBooksSchema,
  reorderSlotsSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type AddPairedEditionWithCoverInput,
  type CreateBookWithCoverInput,
  type GetCatalogInput,
  type UpdateBookWithCoverInput,
} from "@/lib/validations/catalog";

export type { GoogleBookSearchResult } from "@/lib/validations/google-books";
import {
  searchGoogleBooksSchema,
  type GoogleBookSearchResult,
} from "@/lib/validations/google-books";

export type CreateBookActionResult = Awaited<ReturnType<typeof createBookWithCover>>;

function formString(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function formCover(formData: FormData) {
  const value = formData.get("cover");
  if (!(value instanceof File) || value.size === 0) return undefined;
  return {
    body: new Uint8Array(await value.arrayBuffer()),
    declaredType: value.type,
  };
}

export async function createBookAction(
  input: FormData | CreateBookWithCoverInput,
): Promise<CreateBookActionResult> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  const parsedInput: CreateBookWithCoverInput =
    input instanceof FormData
      ? {
          title: formString(input, "title") ?? "",
          language: formString(input, "language"),
          author: formString(input, "author"),
          summary: formString(input, "summary"),
          pageCount: formString(input, "pageCount") ?? "",
          coverUrl: formString(input, "coverUrl"),
          cover: await formCover(input),
        }
      : input;

  try {
    return await createBookWithCover(parsedInput);
  } catch (error) {
    console.error("createBookAction error:", error);
    return {
      ok: false,
      errors: [{ field: "form", message: "Failed to create book.", code: "INTERNAL_ERROR" }],
    };
  }
}

export type UpdateBookActionResult = Awaited<ReturnType<typeof updateBookWithCover>>;

export async function updateBookAction(
  input: FormData | UpdateBookWithCoverInput,
): Promise<UpdateBookActionResult> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  let parsedInput: UpdateBookWithCoverInput;
  if (input instanceof FormData) {
    const raw = (name: string) => input.get(name);
    const stringValue = (name: string) => {
      const value = raw(name);
      return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };
    const rawCover = raw("cover");
    let cover: UpdateBookWithCoverInput["cover"];
    if (rawCover instanceof File && rawCover.size > 0) {
      cover = {
        body: new Uint8Array(await rawCover.arrayBuffer()),
        declaredType: rawCover.type,
      };
    }
    parsedInput = {
      bookId: stringValue("bookId") ?? "",
      title: stringValue("title") ?? "",
      language: stringValue("language"),
      author: stringValue("author"),
      summary: stringValue("summary"),
      pageCount: stringValue("pageCount") ?? "",
      coverUrl: stringValue("coverUrl"),
      cover,
    };
  } else {
    parsedInput = input;
  }

  try {
    return await updateBookWithCover(parsedInput);
  } catch (error) {
    console.error("updateBookAction error:", error);
    return {
      ok: false,
      errors: [{ field: "form", message: "Failed to update book.", code: "INTERNAL_ERROR" }],
    };
  }
}

export async function deleteBookAction(input: { bookId: string }): Promise<DeleteBookResult> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  try {
    return await deleteBook(input);
  } catch (error) {
    console.error("deleteBookAction error:", error);
    return {
      ok: false,
      errors: [{ field: "form", message: "Failed to delete book.", code: "INTERNAL_ERROR" }],
    };
  }
}

export type AddPairedEditionActionResult =
  | {
      ok: true;
      data: {
        id: string;
        title: string;
        language: string;
        author?: string | null;
        coverUrl?: string | null;
        summary?: string | null;
        pageCount?: number | null;
        sequenceOrder: number;
        pairedBookId?: string | null;
      };
    }
  | { ok: false; errors: import("@/lib/validations/cover-image").FieldError[] }
  | {
      ok: false;
      errors: import("@/lib/validations/cover-image").FieldError[];
      conflict: true;
      existingEditionId: string;
      message: string;
    };

/**
 * Server action to add a paired edition to an existing catalog slot.
 *
 * Enforces:
 * 1. Super-admin role authorization (checked inside the action).
 * 2. Slot inheritance: assigns existing slot's sequence_order, consuming NO new slot.
 * 3. Atomic transaction ensuring bidirectional pairing link between editions.
 * 4. Language uniqueness within the slot.
 * 5. Cleans up orphaned uploads if database insertion fails.
 */
export async function addPairedEditionAction(
  input: FormData | AddPairedEditionWithCoverInput,
): Promise<AddPairedEditionActionResult> {
  // 1. Authorize: super_admin only
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  // 2. Parse input into AddPairedEditionWithCoverInput format
  let parsedInput: AddPairedEditionWithCoverInput;

  if (input instanceof FormData) {
    const rawPairedBookId = input.get("pairedBookId");
    const rawTitle = input.get("title");
    const rawLanguage = input.get("language");
    const rawAuthor = input.get("author");
    const rawSummary = input.get("summary");
    const rawPageCount = input.get("pageCount");
    const rawCover = input.get("cover");
    const rawCoverUrl = input.get("coverUrl");
    const rawEditionId = input.get("editionId");
    const rawOverrideEditionId = input.get("overrideEditionId");

    const pairedBookId =
      typeof rawPairedBookId === "string" ? rawPairedBookId.trim() : "";
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    const language =
      typeof rawLanguage === "string" && rawLanguage.trim().length > 0
        ? rawLanguage.trim()
        : undefined;
    const author =
      typeof rawAuthor === "string" && rawAuthor.trim().length > 0
        ? rawAuthor.trim()
        : undefined;
    const summary =
      typeof rawSummary === "string" && rawSummary.trim().length > 0
        ? rawSummary.trim()
        : undefined;
    const pageCount =
      typeof rawPageCount === "string" && rawPageCount.trim().length > 0
        ? rawPageCount.trim()
        : "";
    const coverUrl =
      typeof rawCoverUrl === "string" && rawCoverUrl.trim().length > 0
        ? rawCoverUrl.trim()
        : undefined;
    const editionId =
      typeof rawEditionId === "string" && rawEditionId.trim().length > 0
        ? rawEditionId.trim()
        : undefined;
    const overrideEditionId =
      typeof rawOverrideEditionId === "string" &&
      rawOverrideEditionId.trim().length > 0
        ? rawOverrideEditionId.trim()
        : undefined;

    let coverPayload: { body: Uint8Array; declaredType?: string } | undefined;
    if (rawCover instanceof File && rawCover.size > 0) {
      const buffer = await rawCover.arrayBuffer();
      coverPayload = {
        body: new Uint8Array(buffer),
        declaredType: rawCover.type,
      };
    }

    parsedInput = {
      pairedBookId,
      title,
      language,
      author,
      summary,
      pageCount,
      coverUrl,
      cover: coverPayload,
      editionId,
      overrideEditionId,
    };
  } else {
    parsedInput = input;
  }

  // 3. Delegate to service layer with storage service
  try {
    return await addPairedEditionWithCover(parsedInput);
  } catch (error) {
    console.error("addPairedEditionAction error:", error);
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message: "Failed to add paired edition.",
          code: "INTERNAL_ERROR",
        },
      ],
    };
  }
}

export type ReorderCatalogSlotsActionResult = ActionResult<{
  fromSlot: number;
  toSlot: number;
  movedSlotsCount: number;
}>;

export type ReorderBooksActionResult = ActionResult<{
  orderedIds: string[];
  sequenceOrders: number[];
}>;

/**
 * Server action to reorder catalog slots atomically.
 *
 * Enforces:
 * 1. Super-admin role authorization (checked inside the action).
 * 2. Moves entire slot (all language editions sharing fromSlot move together).
 * 3. Renumbers all affected slots contiguously (1..N with no gaps).
 * 4. Safe against unique constraint collisions using temporary sequence offsets.
 * 5. Full transactional rollback if any DB step fails.
 */
export async function reorderCatalogSlotsAction(
  input: unknown,
): Promise<ReorderCatalogSlotsActionResult> {
  // 1. Authorize: super_admin only
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  // 2. Validate input
  const parsed = reorderSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  // 3. Delegate to reorder service
  try {
    return await reorderCatalogSlots(parsed.data);
  } catch (error) {
    console.error("reorderCatalogSlotsAction error:", error);
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message: "Failed to reorder catalog slots.",
          code: "INTERNAL_ERROR",
        },
      ],
    };
  }
}

/**
 * Persist a new within-page curriculum order from representative book ids.
 * Each id stands for its full slot (all language editions move together).
 */
export async function reorderBooksAction(
  orderedIds: string[],
): Promise<ReorderBooksActionResult> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  const parsed = reorderBooksSchema.safeParse({ orderedIds });
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  try {
    return await reorderBooks(parsed.data);
  } catch (error) {
    console.error("reorderBooksAction error:", error);
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message: "Failed to reorder books.",
          code: "INTERNAL_ERROR",
        },
      ],
    };
  }
}

export type GetCatalogActionResult = ActionResult<PaginatedCatalogResult>;

/**
 * Server action / query to fetch paginated catalog entries in deterministic order.
 */
export async function getCatalogAction(
  input?: GetCatalogInput,
): Promise<GetCatalogActionResult> {
  try {
    return await getCatalog(input);
  } catch (error) {
    console.error("getCatalogAction error:", error);
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message: "Failed to load catalog.",
          code: "INTERNAL_ERROR",
        },
      ],
    };
  }
}

export type SearchGoogleBooksActionResult = ActionResult<GoogleBookSearchResult[]>;

/**
 * Admin helper: search Google Books for program-book autofill.
 * Does not write to the database.
 */
export async function searchGoogleBooksAction(
  input: unknown,
): Promise<SearchGoogleBooksActionResult> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  const parsed = searchGoogleBooksSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  try {
    const results = await searchGoogleBooks(parsed.data.query);
    return { ok: true, data: results };
  } catch (error) {
    console.error("searchGoogleBooksAction error:", error);
    return {
      ok: false,
      errors: [
        {
          field: "query",
          message: "Failed to search Google Books.",
          code: "INTERNAL_ERROR",
        },
      ],
    };
  }
}


































