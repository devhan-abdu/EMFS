import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  books,
  tasks,
  type Task,
  type TaskStatus,
} from "@/db/schema";
import type {
  CreateTaskInput,
  PublishTaskInput,
  ReviseTaskInput,
  GetTasksForBookInput,
} from "@/lib/validations/task";

// In EMF-17 v1, any pace admin or above can create/revise/publish reusable tasks
// for any catalog book. Book-level scoping is intentionally flat for v1.

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = DbClient | DbTransaction;

export type TaskErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "BOOK_NOT_FOUND"
  | "TASK_NOT_FOUND"
  | "PUBLISHED_TASK_EXISTS"
  | "INVALID_TRANSITION"
  | "TRANSACTION_FAILED";

export class TaskError extends Error {
  code: TaskErrorCode;
  constructor(code: TaskErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "TaskError";
  }
}

export const ALLOWED_TASK_TRANSITIONS: Record<
  TaskStatus,
  readonly TaskStatus[]
> = {
  draft: ["published", "archived"],
  published: ["superseded", "archived"],
  superseded: [],
  archived: [],
};

export function isValidTaskTransition(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  const allowed = ALLOWED_TASK_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Creates a new draft task for a specific book reading step.
 * Checks within a transaction that no published task already exists for this (bookId, dayNumber).
 */
export async function createTask(
  input: CreateTaskInput,
  creatorProfileId: string,
  executor: DbOrTx = db,
): Promise<Task> {
  const runCreate = async (tx: DbOrTx) => {
    const book = await tx.query.books.findFirst({
      where: eq(books.id, input.bookId),
    });

    if (!book) {
      throw new TaskError(
        "BOOK_NOT_FOUND",
        `Book with ID ${input.bookId} was not found.`,
      );
    }

    const existingPublished = await tx.query.tasks.findFirst({
      where: and(
        eq(tasks.bookId, input.bookId),
        eq(tasks.dayNumber, input.dayNumber),
        eq(tasks.status, "published"),
      ),
    });

    if (existingPublished) {
      throw new TaskError(
        "PUBLISHED_TASK_EXISTS",
        `A published task already exists for book '${input.bookId}' and day ${input.dayNumber}. Create a revision instead.`,
      );
    }

    const [newTask] = await tx
      .insert(tasks)
      .values({
        bookId: input.bookId,
        dayNumber: input.dayNumber,
        title: input.title ?? null,
        content: input.content,
        pageStart: input.pageStart ?? null,
        pageEnd: input.pageEnd ?? null,
        pageReference: input.pageReference ?? null,
        status: "draft",
        version: 1,
        previousVersionId: null,
        createdBy: creatorProfileId,
      })
      .returning();

    return newTask;
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runCreate(tx));
  }
  return await runCreate(executor);
}

/**
 * Creates a new draft revision based on an existing published task.
 * Immutable: Never modifies the published task row in place.
 */
export async function reviseTask(
  input: ReviseTaskInput,
  creatorProfileId: string,
  executor: DbOrTx = db,
): Promise<Task> {
  const runRevise = async (tx: DbOrTx) => {
    const existing = await tx.query.tasks.findFirst({
      where: eq(tasks.id, input.taskId),
    });

    if (!existing) {
      throw new TaskError(
        "TASK_NOT_FOUND",
        `Task with ID '${input.taskId}' was not found.`,
      );
    }

    if (existing.status !== "published") {
      throw new TaskError(
        "INVALID_TRANSITION",
        `Cannot revise task with status '${existing.status}'. Revisions must be created from a published task.`,
      );
    }

    const [revision] = await tx
      .insert(tasks)
      .values({
        bookId: existing.bookId,
        dayNumber: existing.dayNumber,
        title: input.title !== undefined ? (input.title ?? null) : existing.title,
        content: input.content ?? existing.content,
        pageStart:
          input.pageStart !== undefined
            ? (input.pageStart ?? null)
            : existing.pageStart,
        pageEnd:
          input.pageEnd !== undefined ? (input.pageEnd ?? null) : existing.pageEnd,
        pageReference:
          input.pageReference !== undefined
            ? (input.pageReference ?? null)
            : existing.pageReference,
        status: "draft",
        version: existing.version + 1,
        previousVersionId: existing.id,
        createdBy: creatorProfileId,
      })
      .returning();

    return revision;
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runRevise(tx));
  }
  return await runRevise(executor);
}

/**
 * Publishes a draft task.
 * Inside the same transaction, any existing published task for the same (bookId, dayNumber)
 * is transitioned to 'superseded' so the partial unique index is never violated
 * and historic references remain intact.
 */
export async function publishTask(
  input: PublishTaskInput,
  actorProfileId: string,
  executor: DbOrTx = db,
): Promise<Task> {
  const runPublish = async (tx: DbOrTx) => {
    const draft = await tx.query.tasks.findFirst({
      where: eq(tasks.id, input.taskId),
    });

    if (!draft) {
      throw new TaskError(
        "TASK_NOT_FOUND",
        `Task with ID ${input.taskId} was not found.`,
      );
    }

    if (draft.status !== "draft") {
      throw new TaskError(
        "INVALID_TRANSITION",
        `Cannot publish task with status '${draft.status}'. Only draft tasks can be published.`,
      );
    }

    // Find any currently published task for the same book and day number
    const currentPublished = await tx.query.tasks.findFirst({
      where: and(
        eq(tasks.bookId, draft.bookId),
        eq(tasks.dayNumber, draft.dayNumber),
        eq(tasks.status, "published"),
      ),
    });

    if (currentPublished) {
      await tx
        .update(tasks)
        .set({
          status: "superseded",
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, currentPublished.id));
    }

    const [published] = await tx
      .update(tasks)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, draft.id))
      .returning();

    return published;
  };

  if (executor === db) {
    return await db.transaction(async (tx) => runPublish(tx));
  }
  return await runPublish(executor);
}

/**
 * Retrieves the published reusable task content for a specific book and reading step.
 */
export async function getPublishedTaskForStep(
  bookId: string,
  dayNumber: number,
  executor: DbOrTx = db,
): Promise<Task | null> {
  const task = await executor.query.tasks.findFirst({
    where: and(
      eq(tasks.bookId, bookId),
      eq(tasks.dayNumber, dayNumber),
      eq(tasks.status, "published"),
    ),
  });

  return task ?? null;
}

/**
 * Retrieves tasks for a book, optionally filtered by status.
 */
export async function getTasksForBook(
  input: GetTasksForBookInput,
  executor: DbOrTx = db,
): Promise<Task[]> {
  const conditions = [eq(tasks.bookId, input.bookId)];
  if (input.status) {
    conditions.push(eq(tasks.status, input.status));
  }

  return await executor.query.tasks.findMany({
    where: and(...conditions),
    orderBy: [asc(tasks.dayNumber), desc(tasks.version)],
  });
}
