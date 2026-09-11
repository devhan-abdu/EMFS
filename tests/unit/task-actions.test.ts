import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTaskAction,
  publishTaskAction,
  reviseTaskAction,
} from "@/actions/task";
import * as authorizeModule from "@/lib/auth/authorize";
import * as taskService from "@/lib/services/task";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
  requireRole: vi.fn(),
  AuthzError: class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "AuthzError";
    }
  },
}));

vi.mock("@/lib/services/task", () => ({
  createTask: vi.fn(),
  publishTask: vi.fn(),
  reviseTask: vi.fn(),
  getTasksForBook: vi.fn(),
  TaskError: class TaskError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "TaskError";
    }
  },
}));

const validAdminProfileId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const validBookId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const validTaskId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

describe("Task Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authorization & Role Requirements", () => {
    it("rejects unauthorized caller when requireRole throws AuthzError", async () => {
      vi.mocked(authorizeModule.requireRole).mockRejectedValue(
        new authorizeModule.AuthzError("FORBIDDEN", "Forbidden: required role pace_admin")
      );

      const result = await createTaskAction({
        bookId: validBookId,
        dayNumber: 1,
        content: "Day 1 content",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("Forbidden: required role pace_admin");
        expect(result.errors[0]?.code).toBe("UNAUTHORIZED");
      }
      expect(taskService.createTask).not.toHaveBeenCalled();
    });

    it("requires pace_admin role for createTaskAction", async () => {
      vi.mocked(authorizeModule.requireRole).mockResolvedValue({
        authUserId: "auth-1",
        email: "paceadmin@example.com",
        profile: {
          id: validAdminProfileId,
          authUserId: "auth-1",
          role: "pace_admin",
          firstName: "Pace",
          fatherName: "Admin",
          grandfatherName: null,
          telegramUsername: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      vi.mocked(taskService.createTask).mockResolvedValue({
        id: validTaskId,
        bookId: validBookId,
        dayNumber: 1,
        title: null,
        content: "Day 1 content",
        pageStart: null,
        pageEnd: null,
        pageReference: null,
        status: "draft",
        version: 1,
        previousVersionId: null,
        createdBy: validAdminProfileId,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createTaskAction({
        bookId: validBookId,
        dayNumber: 1,
        content: "Day 1 content",
      });

      expect(authorizeModule.requireRole).toHaveBeenCalledWith(["pace_admin"]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe(validTaskId);
      }
    });
  });

  describe("Validation Errors", () => {
    it("returns validation failure on invalid input payload", async () => {
      vi.mocked(authorizeModule.requireRole).mockResolvedValue({
        authUserId: "auth-1",
        email: "paceadmin@example.com",
        profile: {
          id: validAdminProfileId,
          authUserId: "auth-1",
          role: "pace_admin",
          firstName: "Pace",
          fatherName: "Admin",
          grandfatherName: null,
          telegramUsername: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await createTaskAction({
        bookId: "not-a-uuid",
        dayNumber: -1,
        content: "",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
      expect(taskService.createTask).not.toHaveBeenCalled();
    });
  });

  describe("Service Error Handling", () => {
    it("formats TaskError into ActionResult error object", async () => {
      vi.mocked(authorizeModule.requireRole).mockResolvedValue({
        authUserId: "auth-1",
        email: "paceadmin@example.com",
        profile: {
          id: validAdminProfileId,
          authUserId: "auth-1",
          role: "pace_admin",
          firstName: "Pace",
          fatherName: "Admin",
          grandfatherName: null,
          telegramUsername: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      vi.mocked(taskService.createTask).mockRejectedValue(
        new taskService.TaskError(
          "PUBLISHED_TASK_EXISTS",
          "A published task already exists for this day."
        )
      );

      const result = await createTaskAction({
        bookId: validBookId,
        dayNumber: 1,
        content: "Day 1 content",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe("A published task already exists for this day.");
        expect(result.errors[0]?.code).toBe("PUBLISHED_TASK_EXISTS");
      }
    });
  });

  describe("publishTaskAction & reviseTaskAction", () => {
    it("executes publishTaskAction successfully", async () => {
      vi.mocked(authorizeModule.requireRole).mockResolvedValue({
        authUserId: "auth-1",
        email: "paceadmin@example.com",
        profile: {
          id: validAdminProfileId,
          authUserId: "auth-1",
          role: "pace_admin",
          firstName: "Pace",
          fatherName: "Admin",
          grandfatherName: null,
          telegramUsername: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      vi.mocked(taskService.publishTask).mockResolvedValue({
        id: validTaskId,
        bookId: validBookId,
        dayNumber: 1,
        title: null,
        content: "Day 1 content",
        pageStart: null,
        pageEnd: null,
        pageReference: null,
        status: "published",
        version: 1,
        previousVersionId: null,
        createdBy: validAdminProfileId,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await publishTaskAction({ taskId: validTaskId });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("published");
      }
    });

    it("executes reviseTaskAction successfully", async () => {
      vi.mocked(authorizeModule.requireRole).mockResolvedValue({
        authUserId: "auth-1",
        email: "paceadmin@example.com",
        profile: {
          id: validAdminProfileId,
          authUserId: "auth-1",
          role: "pace_admin",
          firstName: "Pace",
          fatherName: "Admin",
          grandfatherName: null,
          telegramUsername: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      vi.mocked(taskService.reviseTask).mockResolvedValue({
        id: "new-version-task-id",
        bookId: validBookId,
        dayNumber: 1,
        title: null,
        content: "Revised content",
        pageStart: null,
        pageEnd: null,
        pageReference: null,
        status: "draft",
        version: 2,
        previousVersionId: validTaskId,
        createdBy: validAdminProfileId,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await reviseTaskAction({
        taskId: validTaskId,
        content: "Revised content",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version).toBe(2);
        expect(result.data.previousVersionId).toBe(validTaskId);
      }
    });
  });
});
