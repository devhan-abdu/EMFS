"use server";

import { revalidatePath } from "next/cache";
import { requireRole, AuthzError } from "@/lib/auth/authorize";
import {
  createTask,
  publishTask,
  reviseTask,
  getTasksForBook,
  TaskError,
} from "@/lib/services/task";
import {
  createTaskSchema,
  publishTaskSchema,
  reviseTaskSchema,
  getTasksForBookSchema,
  type CreateTaskInput,
  type PublishTaskInput,
  type ReviseTaskInput,
  type GetTasksForBookInput,
} from "@/lib/validations/task";
import {
  type ActionResult,
  zodErrorToFieldErrors,
} from "@/lib/validations/catalog";
import type { Task } from "@/db/schema";

/**
 * Server action to create a new draft task for a book reading step.
 * Accessible to pace_admin, batch_admin, and super_admin (via rank inheritance).
 */
export async function createTaskAction(
  rawInput: CreateTaskInput
): Promise<ActionResult<Task>> {
  let currentUser;
  try {
    currentUser = await requireRole(["pace_admin"]);
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false,
        errors: [{ field: "auth", message: error.message, code: "UNAUTHORIZED" }],
        message: error.message,
      };
    }
    throw error;
  }

  const parsed = createTaskSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      errors: zodErrorToFieldErrors(parsed.error),
      message: "Invalid task input.",
    };
  }

  try {
    const task = await createTask(parsed.data, currentUser.profile.id);
    revalidatePath(`/admin/catalog/books/${parsed.data.bookId}`);
    return {
      ok: true,
      data: task,
    };
  } catch (error) {
    if (error instanceof TaskError) {
      return {
        ok: false,
        errors: [{ field: "form", message: error.message, code: error.code }],
        message: error.message,
      };
    }
    throw error;
  }
}

/**
 * Server action to publish a draft task.
 * Supersedes any currently published task for that (bookId, dayNumber) inside a transaction.
 */
export async function publishTaskAction(
  rawInput: PublishTaskInput
): Promise<ActionResult<Task>> {
  let currentUser;
  try {
    currentUser = await requireRole(["pace_admin"]);
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false,
        errors: [{ field: "auth", message: error.message, code: "UNAUTHORIZED" }],
        message: error.message,
      };
    }
    throw error;
  }

  const parsed = publishTaskSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      errors: zodErrorToFieldErrors(parsed.error),
      message: "Invalid task ID.",
    };
  }

  try {
    const task = await publishTask(parsed.data, currentUser.profile.id);
    revalidatePath(`/admin/catalog/books/${task.bookId}`);
    return {
      ok: true,
      data: task,
    };
  } catch (error) {
    if (error instanceof TaskError) {
      return {
        ok: false,
        errors: [{ field: "form", message: error.message, code: error.code }],
        message: error.message,
      };
    }
    throw error;
  }
}

/**
 * Server action to revise an existing published task.
 * Creates a new draft version branching from the published task.
 */
export async function reviseTaskAction(
  rawInput: ReviseTaskInput
): Promise<ActionResult<Task>> {
  let currentUser;
  try {
    currentUser = await requireRole(["pace_admin"]);
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false,
        errors: [{ field: "auth", message: error.message, code: "UNAUTHORIZED" }],
        message: error.message,
      };
    }
    throw error;
  }

  const parsed = reviseTaskSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      errors: zodErrorToFieldErrors(parsed.error),
      message: "Invalid task revision input.",
    };
  }

  try {
    const task = await reviseTask(parsed.data, currentUser.profile.id);
    revalidatePath(`/admin/catalog/books/${task.bookId}`);
    return {
      ok: true,
      data: task,
    };
  } catch (error) {
    if (error instanceof TaskError) {
      return {
        ok: false,
        errors: [{ field: "form", message: error.message, code: error.code }],
        message: error.message,
      };
    }
    throw error;
  }
}

/**
 * Server action to query tasks for a book.
 */
export async function getTasksForBookAction(
  rawInput: GetTasksForBookInput
): Promise<ActionResult<Task[]>> {
  let _currentUser;
  try {
    _currentUser = await requireRole(["pace_admin"]);
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false,
        errors: [{ field: "auth", message: error.message, code: "UNAUTHORIZED" }],
        message: error.message,
      };
    }
    throw error;
  }

  const parsed = getTasksForBookSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      errors: zodErrorToFieldErrors(parsed.error),
      message: "Invalid book ID.",
    };
  }

  try {
    const taskList = await getTasksForBook(parsed.data);
    return {
      ok: true,
      data: taskList,
    };
  } catch (error) {
    if (error instanceof TaskError) {
      return {
        ok: false,
        errors: [{ field: "form", message: error.message, code: error.code }],
        message: error.message,
      };
    }
    throw error;
  }
}
