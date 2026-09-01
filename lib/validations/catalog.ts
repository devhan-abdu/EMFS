import { z } from "zod";
import type { FieldError } from "./cover-image";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldError[] };

export function zodErrorToFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path[0]?.toString() ?? "form",
    message: issue.message,
    code: issue.code,
  }));
}

export const createBookSchema = z.object({
  title: z.string().min(1),
  language: z.string().regex(/^[a-z]{2,5}$/, "language must be a 2–5 letter lowercase code (e.g. en, am)"),
  author: z.string().optional(),
  coverUrl: z.string().optional(),
  pairedBookId: z.string().uuid().optional(),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;

export const addPairedEditionSchema = z.object({
  pairedBookId: z.string().uuid("pairedBookId must be a valid UUID"),
  title: z.string().min(1, "Title is required"),
  language: z.string().regex(
    /^[a-z]{2,5}$/,
    "language must be a 2–5 letter lowercase code (e.g. en, am)",
  ),
  author: z.string().optional(),
  coverUrl: z.string().optional(),
});

export type AddPairedEditionInput = z.infer<typeof addPairedEditionSchema>;

export const reorderSlotsSchema = z.object({
  fromSlot: z.coerce.number().int().positive("fromSlot must be a positive integer"),
  toSlot: z.coerce.number().int().positive("toSlot must be a positive integer"),
});

export type ReorderSlotsInput = z.infer<typeof reorderSlotsSchema>;

export const createTaskSchema = z.object({
  bookId: z.string().uuid(),
  dayNumber: z.number().int().positive(),
  content: z.string().min(1),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const getCatalogSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetCatalogInput = z.infer<typeof getCatalogSchema>;




