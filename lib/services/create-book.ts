import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { books } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth/authorize";
import type { StorageService } from "@/lib/services/storage/storage-service";
import { uploadCoverImage } from "@/lib/services/upload-cover-image";
import {
  addPairedEditionSchema,
  createBookSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type AddPairedEditionInput,
  type CreateBookInput,
} from "@/lib/validations/catalog";
import type { FieldError } from "@/lib/validations/cover-image";

export type CreateBookWithCoverInput = CreateBookInput & {
  cover?: {
    body: Uint8Array;
    declaredType?: string;
  };
};

export type CreateBookWithCoverResult =
  | {
      ok: true;
      data: {
        id: string;
        title: string;
        language: string;
        author?: string | null;
        coverUrl?: string | null;
        sequenceOrder: number;
        pairedBookId?: string | null;
      };
    }
  | { ok: false; errors: FieldError[] };

export async function createBookWithCover(
  input: CreateBookWithCoverInput,
  storageService: StorageService,
): Promise<CreateBookWithCoverResult> {
  await requireSuperAdmin();

  const parsed = createBookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const data = parsed.data;

  const cover = input.cover;
  let coverUrl: string | undefined;

  if (cover) {
    const uploaded = await uploadCoverImage(cover, storageService);

    if (!uploaded.ok) {
      return { ok: false, errors: uploaded.errors };
    }

    coverUrl = uploaded.data.key;
  }

  const nextSequenceOrder = await getNextSequenceOrder();

  try {
    const [book] = await db
      .insert(books)
      .values({
        title: data.title,
        language: data.language,
        author: data.author,
        coverUrl,
        sequenceOrder: nextSequenceOrder,
      })
      .returning({
        id: books.id,
        title: books.title,
        language: books.language,
        author: books.author,
        coverUrl: books.coverUrl,
        sequenceOrder: books.sequenceOrder,
        pairedBookId: books.pairedBookId,
      });

    return {
      ok: true,
      data: {
        id: book.id,
        title: book.title,
        language: book.language,
        author: book.author,
        coverUrl: book.coverUrl,
        sequenceOrder: book.sequenceOrder,
        pairedBookId: book.pairedBookId,
      },
    };
  } catch (error) {
    if (coverUrl) {
      await cleanupOrphanedUpload(coverUrl, storageService);
    }
    throw error;
  }
}

export type AddPairedEditionWithCoverInput = AddPairedEditionInput & {
  cover?: {
    body: Uint8Array;
    declaredType?: string;
  };
};

export type AddPairedEditionResult = ActionResult<{
  id: string;
  title: string;
  language: string;
  author?: string | null;
  coverUrl?: string | null;
  sequenceOrder: number;
  pairedBookId?: string | null;
}>;

/**
 * Adds a paired edition to an existing catalog slot.
 * - Does NOT create a new sequence slot (inherits targetBook.sequenceOrder).
 * - Enforces language difference from target book and uniqueness in the slot.
 * - Links both books bidirectionally in an atomic transaction.
 * - Cleans up orphaned cover upload on failure.
 */
export async function addPairedEditionWithCover(
  input: AddPairedEditionWithCoverInput,
  storageService: StorageService,
): Promise<AddPairedEditionResult> {
  await requireSuperAdmin();

  const parsed = addPairedEditionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const cover = input.cover;
  let coverUrl: string | undefined;

  if (cover) {
    const uploaded = await uploadCoverImage(cover, storageService);
    if (!uploaded.ok) {
      return { ok: false, errors: uploaded.errors };
    }
    coverUrl = uploaded.data.key;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [targetBook] = await tx
        .select()
        .from(books)
        .where(eq(books.id, data.pairedBookId))
        .limit(1);

      if (!targetBook) {
        return {
          ok: false as const,
          errors: [
            {
              field: "pairedBookId",
              message: "Target book to pair with was not found.",
              code: "TARGET_BOOK_NOT_FOUND",
            },
          ],
        };
      }

      if (targetBook.language === data.language) {
        return {
          ok: false as const,
          errors: [
            {
              field: "language",
              message: `Paired edition cannot have the same language ('${data.language}') as the target book.`,
              code: "DUPLICATE_LANGUAGE",
            },
          ],
        };
      }

      if (targetBook.pairedBookId) {
        return {
          ok: false as const,
          errors: [
            {
              field: "pairedBookId",
              message: "Target book is already paired with another edition.",
              code: "TARGET_ALREADY_PAIRED",
            },
          ],
        };
      }

      const [existingSlotLanguage] = await tx
        .select({ id: books.id })
        .from(books)
        .where(
          and(
            eq(books.sequenceOrder, targetBook.sequenceOrder),
            eq(books.language, data.language),
          ),
        )
        .limit(1);

      if (existingSlotLanguage) {
        return {
          ok: false as const,
          errors: [
            {
              field: "language",
              message: `Slot ${targetBook.sequenceOrder} already has an edition for language '${data.language}'.`,
              code: "SLOT_LANGUAGE_EXISTS",
            },
          ],
        };
      }

      const [newBook] = await tx
        .insert(books)
        .values({
          title: data.title,
          language: data.language,
          author: data.author,
          coverUrl,
          pairedBookId: targetBook.id,
          sequenceOrder: targetBook.sequenceOrder,
        })
        .returning({
          id: books.id,
          title: books.title,
          language: books.language,
          author: books.author,
          coverUrl: books.coverUrl,
          sequenceOrder: books.sequenceOrder,
          pairedBookId: books.pairedBookId,
        });

      await tx
        .update(books)
        .set({
          pairedBookId: newBook.id,
          updatedAt: sql`now()`,
        })
        .where(eq(books.id, targetBook.id));

      return {
        ok: true as const,
        data: newBook,
      };
    });

    if (!result.ok && coverUrl) {
      await cleanupOrphanedUpload(coverUrl, storageService);
    }

    return result;
  } catch (error) {
    if (coverUrl) {
      await cleanupOrphanedUpload(coverUrl, storageService);
    }
    throw error;
  }
}

async function getNextSequenceOrder(): Promise<number> {
  const [row] = await db
    .select({
      maxSequenceOrder: sql<number>`max(${books.sequenceOrder})`.as("max_sequence_order"),
    })
    .from(books);

  return row?.maxSequenceOrder == null ? 1 : Number(row.maxSequenceOrder) + 1;
}

export async function cleanupOrphanedUpload(
  key: string,
  storageService: StorageService,
): Promise<void> {
  const [existingBook] = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.coverUrl, key))
    .limit(1);

  if (existingBook) {
    return;
  }

  try {
    await storageService.delete(key);
  } catch (cleanupError) {
    console.error("Failed to remove orphaned object after Book creation failure", {
      key,
      cleanupError:
        cleanupError instanceof Error
          ? { name: cleanupError.name, message: cleanupError.message, stack: cleanupError.stack }
          : cleanupError,
    });
  }
}

