"use server";

import { requireSuperAdmin, AuthzError, authzErrorToFieldError } from "@/lib/auth/authorize";
import { getStorageService } from "@/lib/services/storage/get-storage-service";
import {
  createBookWithCover,
  addPairedEditionWithCover,
  type CreateBookWithCoverInput,
  type AddPairedEditionWithCoverInput,
} from "@/lib/services/create-book";
import { reorderCatalogSlots } from "@/lib/services/reorder-catalog";
import { getCatalog, type PaginatedCatalogResult } from "@/lib/services/get-catalog";
import {
  reorderSlotsSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type GetCatalogInput,
} from "@/lib/validations/catalog";

export type CreateBookActionResult = ActionResult<{
  id: string;
  title: string;
  language: string;
  author?: string | null;
  coverUrl?: string | null;
  sequenceOrder: number;
  pairedBookId?: string | null;
}>;

/**
 * Server action to manually create a new catalog book.
 * 
 * Enforces:
 * 1. Super-admin role authorization (checked inside the action).
 * 2. Manual creation only (title, language, optional author, optional cover).
 * 3. Never accepts sequence_order from the client — derived on the server as max + 1.
 * 4. Stores only the approved cover storage key in PostgreSQL; image bytes remain in object storage.
 * 5. Cleans up orphaned uploads if database insertion fails.
 */
export async function createBookAction(
  input: FormData | CreateBookWithCoverInput,
): Promise<CreateBookActionResult> {
  // 1. Authorize: super_admin only
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return { ok: false, errors: [authzErrorToFieldError(error)] };
    }
    throw error;
  }

  // 2. Parse input into CreateBookWithCoverInput format
  let parsedInput: CreateBookWithCoverInput;

  if (input instanceof FormData) {
    const rawTitle = input.get("title");
    const rawLanguage = input.get("language");
    const rawAuthor = input.get("author");
    const rawCover = input.get("cover");

    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    const language = typeof rawLanguage === "string" ? rawLanguage.trim() : "";
    const author =
      typeof rawAuthor === "string" && rawAuthor.trim().length > 0
        ? rawAuthor.trim()
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
      title,
      language,
      author,
      cover: coverPayload,
    };
  } else {
    // If caller provided a plain object, ensure sequenceOrder is not accepted
    const { title, language, author, cover } = input;
    parsedInput = { title, language, author, cover };
  }

  // 3. Delegate to service layer with storage service
  const storageService = getStorageService();
  try {
    return await createBookWithCover(parsedInput, storageService);
  } catch (error) {
    console.error("createBookAction error:", error);
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message: error instanceof Error ? error.message : "Failed to create book.",
          code: "INTERNAL_ERROR",
        },
      ],
    };
  }
}

export type AddPairedEditionActionResult = ActionResult<{
  id: string;
  title: string;
  language: string;
  author?: string | null;
  coverUrl?: string | null;
  sequenceOrder: number;
  pairedBookId?: string | null;
}>;

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
    const rawCover = input.get("cover");

    const pairedBookId =
      typeof rawPairedBookId === "string" ? rawPairedBookId.trim() : "";
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    const language = typeof rawLanguage === "string" ? rawLanguage.trim() : "";
    const author =
      typeof rawAuthor === "string" && rawAuthor.trim().length > 0
        ? rawAuthor.trim()
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
      cover: coverPayload,
    };
  } else {
    parsedInput = input;
  }

  // 3. Delegate to service layer with storage service
  const storageService = getStorageService();
  try {
    return await addPairedEditionWithCover(parsedInput, storageService);
  } catch (error) {
    console.error("addPairedEditionAction error:", error);
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message:
            error instanceof Error ? error.message : "Failed to add paired edition.",
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
          message:
            error instanceof Error ? error.message : "Failed to reorder catalog slots.",
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
          message:
            error instanceof Error ? error.message : "Failed to load catalog.",
          code: "INTERNAL_ERROR",
        },
      ],
    };
  }
}




