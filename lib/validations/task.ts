import { z } from "zod";
import { TASK_STATUSES } from "@/db/schema/tasks";

/**
 * Validation schema for creating a new task record for a book reading step.
 * Tasks are reusable content blueprints tied directly to a book and dayNumber.
 */
export const createTaskSchema = z
  .object({
    bookId: z.string().uuid("bookId must be a valid UUID"),
    dayNumber: z
      .number()
      .int("dayNumber must be an integer")
      .positive("dayNumber must be positive (>= 1)"),
    title: z
      .string()
      .trim()
      .max(255, "title must not exceed 255 characters")
      .optional()
      .nullable(),
    content: z
      .string()
      .trim()
      .min(1, "content cannot be empty"),
    pageStart: z
      .number()
      .int("pageStart must be an integer")
      .positive("pageStart must be positive (>= 1)")
      .optional()
      .nullable(),
    pageEnd: z
      .number()
      .int("pageEnd must be an integer")
      .positive("pageEnd must be positive (>= 1)")
      .optional()
      .nullable(),
    pageReference: z
      .string()
      .trim()
      .max(100, "pageReference must not exceed 100 characters")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (
        data.pageStart !== undefined &&
        data.pageStart !== null &&
        data.pageEnd !== undefined &&
        data.pageEnd !== null
      ) {
        return data.pageStart <= data.pageEnd;
      }
      return true;
    },
    {
      message: "pageStart cannot be greater than pageEnd",
      path: ["pageStart"],
    }
  );

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Validation schema for publishing a draft task.
 */
export const publishTaskSchema = z.object({
  taskId: z.string().uuid("taskId must be a valid UUID"),
});

export type PublishTaskInput = z.infer<typeof publishTaskSchema>;

/**
 * Validation schema for revising a task.
 * Creates a new draft version pointing to previousVersionId.
 */
export const reviseTaskSchema = z
  .object({
    taskId: z.string().uuid("taskId must be a valid UUID"),
    title: z
      .string()
      .trim()
      .max(255, "title must not exceed 255 characters")
      .optional()
      .nullable(),
    content: z
      .string()
      .trim()
      .min(1, "content cannot be empty")
      .optional(),
    pageStart: z
      .number()
      .int("pageStart must be an integer")
      .positive("pageStart must be positive (>= 1)")
      .optional()
      .nullable(),
    pageEnd: z
      .number()
      .int("pageEnd must be an integer")
      .positive("pageEnd must be positive (>= 1)")
      .optional()
      .nullable(),
    pageReference: z
      .string()
      .trim()
      .max(100, "pageReference must not exceed 100 characters")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (
        data.pageStart !== undefined &&
        data.pageStart !== null &&
        data.pageEnd !== undefined &&
        data.pageEnd !== null
      ) {
        return data.pageStart <= data.pageEnd;
      }
      return true;
    },
    {
      message: "pageStart cannot be greater than pageEnd",
      path: ["pageStart"],
    }
  );

export type ReviseTaskInput = z.infer<typeof reviseTaskSchema>;

/**
 * Validation schema for querying tasks for a catalog book.
 */
export const getTasksForBookSchema = z.object({
  bookId: z.string().uuid("bookId must be a valid UUID"),
  status: z.enum(TASK_STATUSES).optional(),
});

export type GetTasksForBookInput = z.infer<typeof getTasksForBookSchema>;
