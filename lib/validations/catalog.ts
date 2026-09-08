import { z } from "zod";
import type { FieldError } from "./cover-image";

export type ActionFailure = {
  ok: false;
  errors: FieldError[];
  message?: string;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | ActionFailure;

export function zodErrorToFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path[0]?.toString() ?? "form",
    message: issue.message,
    code: issue.code,
  }));
}

const bookLanguageSchema = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? "en" : value),
  z.enum(["en", "am"], {
    message: "language must be en or am",
  }),
);

export const createBookSchema = z.object({
  title: z.string().min(1),
  language: bookLanguageSchema,
  author: z.string().optional(),
  summary: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().max(4000).optional(),
  ),
  pageCount: z.coerce
    .number()
    .int("pageCount must be a whole number")
    .positive("pageCount must be at least 1"),
  coverUrl: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().url("coverUrl must be a valid URL").optional(),
  ),
  pairedBookId: z.string().uuid().optional(),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;

export type CreateBookWithCoverInput = z.input<typeof createBookSchema> & {
  cover?: {
    body: Uint8Array;
    declaredType?: string;
  };
};

export const updateBookSchema = createBookSchema.extend({
  bookId: z.string().uuid("bookId must be a valid UUID"),
});

export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export type UpdateBookWithCoverInput = z.input<typeof updateBookSchema> & {
  cover?: {
    body: Uint8Array;
    declaredType?: string;
  };
};

export const deleteBookSchema = z.object({
  bookId: z.string().uuid("bookId must be a valid UUID"),
});

export type DeleteBookInput = z.infer<typeof deleteBookSchema>;

export const addPairedEditionSchema = z.object({
  pairedBookId: z.string().uuid("pairedBookId must be a valid UUID"),
  title: z.string().min(1, "Title is required"),
  language: bookLanguageSchema,
  author: z.string().optional(),
  summary: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().max(4000).optional(),
  ),
  pageCount: z.coerce
    .number()
    .int("pageCount must be a whole number")
    .positive("pageCount must be at least 1"),
  coverUrl: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().url("coverUrl must be a valid URL").optional(),
  ),
  /** Explicit edit mode — update this edition instead of inserting. */
  editionId: z.string().uuid().optional(),
  /** Conflict overwrite (#5) — same update path as editionId. */
  overrideEditionId: z.string().uuid().optional(),
});

export type AddPairedEditionInput = z.infer<typeof addPairedEditionSchema>;

export type AddPairedEditionWithCoverInput = z.input<
  typeof addPairedEditionSchema
> & {
  cover?: {
    body: Uint8Array;
    declaredType?: string;
  };
};

export const reorderSlotsSchema = z.object({
  fromSlot: z.coerce.number().int().positive("fromSlot must be a positive integer"),
  toSlot: z.coerce.number().int().positive("toSlot must be a positive integer"),
});

export type ReorderSlotsInput = z.infer<typeof reorderSlotsSchema>;

/** One representative book id per curriculum slot, in the desired order. */
export const reorderBooksSchema = z.object({
  orderedIds: z
    .array(z.string().uuid("orderedIds must contain valid UUIDs"))
    .min(1, "orderedIds must include at least one book"),
});

export type ReorderBooksInput = z.infer<typeof reorderBooksSchema>;

export const createTaskSchema = z.object({
  bookId: z.string().uuid(),
  dayNumber: z.number().int().positive(),
  content: z.string().min(1),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const getCatalogSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    /** Preferred page size (slots per page). */
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    /** @deprecated Prefer pageSize — kept for existing callers. */
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .transform((value) => {
    const pageSize = value.pageSize ?? value.limit ?? 10;
    return {
      page: value.page,
      pageSize,
      limit: pageSize,
    };
  });

export type GetCatalogInput = z.input<typeof getCatalogSchema>;
export type GetCatalogParsed = z.output<typeof getCatalogSchema>;




