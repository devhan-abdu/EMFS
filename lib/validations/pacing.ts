import { z } from "zod";

export const resolveCurrentBookSchema = z.object({
  batchId: z.string().uuid("batchId must be a valid UUID"),
  date: z.coerce.date().optional(),
});

export type ResolveCurrentBookInput = z.infer<typeof resolveCurrentBookSchema>;

export const proposeNextPageRangeSchema = z.object({
  cursor: z.number().int().min(0, "cursor must be a non-negative integer"),
  pace: z.number().int().positive("pace must be a positive integer"),
});

export type ProposeNextPageRangeInput = z.infer<typeof proposeNextPageRangeSchema>;

export const getTodayTaskProposalSchema = z.object({
  batchId: z.string().uuid("batchId must be a valid UUID"),
  paceGroupId: z.string().uuid("paceGroupId must be a valid UUID"),
  date: z.coerce.date().optional(),
});

export type GetTodayTaskProposalInput = z.infer<typeof getTodayTaskProposalSchema>;

export const publishPaceGroupTaskSchema = z.object({
  batchId: z.string().uuid("batchId must be a valid UUID"),
  paceGroupId: z.string().uuid("paceGroupId must be a valid UUID"),
  bookId: z.string().uuid("bookId must be a valid UUID"),
  startPage: z.number().int().positive("startPage must be a positive integer"),
  endPage: z.number().int().positive("endPage must be a positive integer"),
  content: z.string().optional(),
  taskId: z.string().uuid("taskId must be a valid UUID").optional(),
}).refine((data) => data.endPage >= data.startPage, {
  message: "endPage must be greater than or equal to startPage",
  path: ["endPage"],
});

export type PublishPaceGroupTaskInput = z.infer<typeof publishPaceGroupTaskSchema>;
