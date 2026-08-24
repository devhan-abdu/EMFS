import { z } from "zod";

export const createBookSchema = z.object({
  title: z.string().min(1),
  language: z.string().regex(/^[a-z]{2,5}$/, "language must be a 2–5 letter lowercase code (e.g. en, am)"),
  author: z.string().optional(),
  coverUrl: z.string().optional(),
  pairedBookId: z.string().uuid().optional(),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;

export const createTaskSchema = z.object({
  bookId: z.string().uuid(),
  dayNumber: z.number().int().positive(),
  content: z.string().min(1),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
