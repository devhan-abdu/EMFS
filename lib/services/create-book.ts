import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { books } from "@/db/schema";
import type { StorageService } from "@/lib/services/storage/storage-service";
import { uploadCoverImage } from "@/lib/services/upload-cover-image";
import { createBookSchema, type CreateBookInput } from "@/lib/validations/catalog";
import type { FieldError } from "@/lib/validations/cover-image";

export type CreateBookWithCoverInput = CreateBookInput & {
  cover?: {
    body: Uint8Array;
    declaredType?: string;
  };
};

export type CreateBookWithCoverResult =
  | { ok: true; data: { id: string; title: string; language: string; author?: string | null; coverUrl?: string | null } }
  | { ok: false; errors: FieldError[] };

export async function createBookWithCover(
  input: CreateBookWithCoverInput,
  storageService: StorageService,
): Promise<CreateBookWithCoverResult> {
  const parsed = createBookSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      field: issue.path[0]?.toString() ?? "book",
      message: issue.message,
      code: issue.code,
    }));
    return { ok: false, errors: issues };
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

  const nextSequenceOrder = await getNextSequenceOrder(data.language);

  try {
    const [book] = await db
      .insert(books)
      .values({
        title: data.title,
        language: data.language,
        author: data.author,
        coverUrl,
        pairedBookId: data.pairedBookId,
        sequenceOrder: nextSequenceOrder,
      })
      .returning({
        id: books.id,
        title: books.title,
        language: books.language,
        author: books.author,
        coverUrl: books.coverUrl,
      });

    return {
      ok: true,
      data: {
        id: book.id,
        title: book.title,
        language: book.language,
        author: book.author,
        coverUrl: book.coverUrl,
      },
    };
  } catch (error) {
    if (coverUrl) {
      await cleanupOrphanedUpload(coverUrl, storageService);
    }
    throw error;
  }
}

async function getNextSequenceOrder(language: string): Promise<number> {
  const [row] = await db
    .select({
      maxSequenceOrder: sql<number>`max(${books.sequenceOrder})`.as("max_sequence_order"),
    })
    .from(books)
    .where(eq(books.language, language));

  return row?.maxSequenceOrder == null ? 1 : Number(row.maxSequenceOrder) + 1;
}

async function cleanupOrphanedUpload(
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
