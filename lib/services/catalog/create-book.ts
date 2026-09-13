import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { books } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth/authorize";
import {
  deleteFromCloudinary,
  isCloudinaryUrl,
} from "@/lib/services/catalog/cloudinary";
import { uploadCoverImage } from "@/lib/services/catalog/upload-cover-image";
import {
  addPairedEditionSchema,
  createBookSchema,
  updateBookSchema,
  zodErrorToFieldErrors,
  type ActionResult,
  type AddPairedEditionWithCoverInput,
  type CreateBookWithCoverInput,
  type UpdateBookWithCoverInput,
} from "@/lib/validations/catalog";
import type { FieldError } from "@/lib/validations/cover-image";

export type CreateBookWithCoverResult =
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
  | { ok: false; errors: FieldError[] };

export async function createBookWithCover(
  input: CreateBookWithCoverInput,
): Promise<CreateBookWithCoverResult> {
  await requireSuperAdmin();

  const parsed = createBookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const data = parsed.data;

  const cover = input.cover;
  let coverUrl: string | undefined;
  let uploadedCoverUrl: string | undefined;

  if (cover) {
    const uploaded = await uploadCoverImage(cover);

    if (!uploaded.ok) {
      return { ok: false, errors: uploaded.errors };
    }

    coverUrl = uploaded.data.url;
    uploadedCoverUrl = uploaded.data.url;
  } else if (data.coverUrl) {
    // External cover (e.g. Google Books thumbnail) — store as-is, no upload.
    coverUrl = data.coverUrl;
  }

  try {
    const [book] = await db
      .insert(books)
      .values({
        title: data.title,
        language: data.language,
        author: data.author,
        coverUrl,
        summary: data.summary,
        pageCount: data.pageCount,
        // Next curriculum slot: global max + 1 (shared across language editions).
        sequenceOrder: sql`COALESCE((SELECT max(${books.sequenceOrder}) FROM ${books}), 0) + 1`,
      })
      .returning({
        id: books.id,
        title: books.title,
        language: books.language,
        author: books.author,
        coverUrl: books.coverUrl,
        summary: books.summary,
        pageCount: books.pageCount,
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
        summary: book.summary,
        pageCount: book.pageCount,
        sequenceOrder: book.sequenceOrder,
        pairedBookId: book.pairedBookId,
      },
    };
  } catch (error) {
    if (uploadedCoverUrl) {
      await cleanupOrphanedUpload(uploadedCoverUrl);
    }
    throw error;
  }
}

export type UpdateBookResult = ActionResult<{
  id: string;
  title: string;
  language: string;
  author?: string | null;
  coverUrl?: string | null;
  summary?: string | null;
  pageCount?: number | null;
  sequenceOrder: number;
  pairedBookId?: string | null;
}>;

/**
 * Updates a catalog book in place. Does not change sequenceOrder or pairing.
 */
export async function updateBookWithCover(
  input: UpdateBookWithCoverInput,
): Promise<UpdateBookResult> {
  await requireSuperAdmin();

  const parsed = updateBookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const cover = input.cover;
  let coverUrl: string | undefined;
  let uploadedCoverUrl: string | undefined;

  if (cover) {
    const uploaded = await uploadCoverImage(cover);
    if (!uploaded.ok) {
      return { ok: false, errors: uploaded.errors };
    }
    coverUrl = uploaded.data.url;
    uploadedCoverUrl = uploaded.data.url;
  } else if (data.coverUrl) {
    coverUrl = data.coverUrl;
  }

  try {
    const [existing] = await db
      .select({ id: books.id, sequenceOrder: books.sequenceOrder })
      .from(books)
      .where(eq(books.id, data.bookId))
      .limit(1);

    if (!existing) {
      if (uploadedCoverUrl) {
        await cleanupOrphanedUpload(uploadedCoverUrl);
      }
      return {
        ok: false,
        errors: [
          {
            field: "bookId",
            message: "Book was not found.",
            code: "BOOK_NOT_FOUND",
          },
        ],
      };
    }

    const [languageClash] = await db
      .select({ id: books.id })
      .from(books)
      .where(
        and(
          eq(books.sequenceOrder, existing.sequenceOrder),
          eq(books.language, data.language),
        ),
      )
      .limit(1);

    if (languageClash && languageClash.id !== existing.id) {
      if (uploadedCoverUrl) {
        await cleanupOrphanedUpload(uploadedCoverUrl);
      }
      return {
        ok: false,
        errors: [
          {
            field: "language",
            message: `Slot ${existing.sequenceOrder} already has an edition for language '${data.language}'.`,
            code: "SLOT_LANGUAGE_EXISTS",
          },
        ],
      };
    }

    const [updated] = await db
      .update(books)
      .set({
        title: data.title,
        language: data.language,
        author: data.author ?? null,
        summary: data.summary ?? null,
        pageCount: data.pageCount,
        ...(coverUrl !== undefined ? { coverUrl } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(books.id, data.bookId))
      .returning({
        id: books.id,
        title: books.title,
        language: books.language,
        author: books.author,
        coverUrl: books.coverUrl,
        summary: books.summary,
        pageCount: books.pageCount,
        sequenceOrder: books.sequenceOrder,
        pairedBookId: books.pairedBookId,
      });

    return { ok: true, data: updated };
  } catch (error) {
    if (uploadedCoverUrl) {
      await cleanupOrphanedUpload(uploadedCoverUrl);
    }
    throw error;
  }
}

export type AddPairedEditionResult =
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
  | { ok: false; errors: FieldError[] }
  | {
      ok: false;
      errors: FieldError[];
      conflict: true;
      existingEditionId: string;
      message: string;
    };

export async function addPairedEditionWithCover(
  input: AddPairedEditionWithCoverInput,
): Promise<AddPairedEditionResult> {
  await requireSuperAdmin();

  const parsed = addPairedEditionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorToFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const editEditionId = data.editionId ?? data.overrideEditionId;
  const cover = input.cover;
  let coverUrl: string | undefined;
  let uploadedCoverUrl: string | undefined;

  if (cover) {
    const uploaded = await uploadCoverImage(cover);
    if (!uploaded.ok) {
      return { ok: false, errors: uploaded.errors };
    }
    coverUrl = uploaded.data.url;
    uploadedCoverUrl = uploaded.data.url;
  } else if (data.coverUrl) {
    coverUrl = data.coverUrl;
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

      if (editEditionId) {
        const [existingEdition] = await tx
          .select()
          .from(books)
          .where(eq(books.id, editEditionId))
          .limit(1);

        if (!existingEdition) {
          return {
            ok: false as const,
            errors: [
              {
                field: "editionId",
                message: "Edition to update was not found.",
                code: "EDITION_NOT_FOUND",
              },
            ],
          };
        }

        if (
          existingEdition.sequenceOrder !== targetBook.sequenceOrder &&
          existingEdition.pairedBookId !== targetBook.id
        ) {
          return {
            ok: false as const,
            errors: [
              {
                field: "editionId",
                message: "Edition does not belong to the selected program book.",
                code: "EDITION_MISMATCH",
              },
            ],
          };
        }

        if (data.language !== existingEdition.language) {
          const [languageClash] = await tx
            .select({ id: books.id })
            .from(books)
            .where(
              and(
                eq(books.sequenceOrder, targetBook.sequenceOrder),
                eq(books.language, data.language),
              ),
            )
            .limit(1);

          if (languageClash && languageClash.id !== existingEdition.id) {
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
        }

        const [updated] = await tx
          .update(books)
          .set({
            title: data.title,
            language: data.language,
            author: data.author ?? null,
            summary: data.summary ?? null,
            pageCount: data.pageCount,
            ...(coverUrl !== undefined ? { coverUrl } : {}),
            updatedAt: sql`now()`,
          })
          .where(eq(books.id, existingEdition.id))
          .returning({
            id: books.id,
            title: books.title,
            language: books.language,
            author: books.author,
            coverUrl: books.coverUrl,
            summary: books.summary,
            pageCount: books.pageCount,
            sequenceOrder: books.sequenceOrder,
            pairedBookId: books.pairedBookId,
          });

        return {
          ok: true as const,
          data: updated,
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

      // Create-only: surface conflicts instead of inserting a second edition.
      if (targetBook.pairedBookId) {
        return {
          ok: false as const,
          errors: [],
          conflict: true as const,
          existingEditionId: targetBook.pairedBookId,
          message:
            "An edition in this language already exists for this book.",
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
          errors: [],
          conflict: true as const,
          existingEditionId: existingSlotLanguage.id,
          message:
            "An edition in this language already exists for this book.",
        };
      }

      const [newBook] = await tx
        .insert(books)
        .values({
          title: data.title,
          language: data.language,
          author: data.author,
          coverUrl,
          summary: data.summary,
          pageCount: data.pageCount,
          pairedBookId: targetBook.id,
          sequenceOrder: targetBook.sequenceOrder,
        })
        .returning({
          id: books.id,
          title: books.title,
          language: books.language,
          author: books.author,
          coverUrl: books.coverUrl,
          summary: books.summary,
          pageCount: books.pageCount,
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

    if (!result.ok && uploadedCoverUrl) {
      await cleanupOrphanedUpload(uploadedCoverUrl);
    }

    return result;
  } catch (error) {
    if (uploadedCoverUrl) {
      await cleanupOrphanedUpload(uploadedCoverUrl);
    }
    throw error;
  }
}

export async function cleanupOrphanedUpload(
  coverReference: string,
): Promise<void> {
  // Only Cloudinary uploads are deleted on rollback.
  if (!isCloudinaryUrl(coverReference)) {
    return;
  }

  const [existingBook] = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.coverUrl, coverReference))
    .limit(1);

  if (existingBook) {
    return;
  }

  try {
    await deleteFromCloudinary(coverReference);
  } catch (cleanupError) {
    console.error(
      "Failed to remove orphaned cover after book creation failure",
      {
        coverReference,
        cleanupError:
          cleanupError instanceof Error ?
            {
              name: cleanupError.name,
              message: cleanupError.message,
              stack: cleanupError.stack,
            }
          : cleanupError,
      },
    );
  }
}
