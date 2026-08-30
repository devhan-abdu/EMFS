import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole, requireSuperAdmin, AuthzError, authzErrorToFieldError, type Role } from "../lib/auth/authorize";
import * as sessionModule from "../lib/auth/session";

vi.mock("server-only", () => ({}));
vi.mock("../lib/auth/session", () => ({
  getCurrentUser: vi.fn(),
}));

describe("requireRole & requireSuperAdmin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws UNAUTHENTICATED when no user is signed in", async () => {
    vi.mocked(sessionModule.getCurrentUser).mockResolvedValue(null);

    await expect(requireSuperAdmin()).rejects.toThrowError(AuthzError);
    await expect(requireSuperAdmin()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "You must be signed in.",
    });
  });

  it.each<[Role, boolean]>([
    ["member", false],
    ["pace_admin", false],
    ["batch_admin", false],
    ["super_admin", true],
  ])("role '%s' permitted for requireSuperAdmin: %s", async (role, shouldPass) => {
    vi.mocked(sessionModule.getCurrentUser).mockResolvedValue({
      authUserId: "auth-123",
      email: "user@example.com",
      profile: {
        id: "prof-123",
        authUserId: "auth-123",
        role: role,
        firstName: "Test",
        fatherName: "User",
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    if (shouldPass) {
      const user = await requireSuperAdmin();
      expect(user.profile.role).toBe(role);
    } else {
      await expect(requireSuperAdmin()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("formats AuthzError into FieldError correctly via authzErrorToFieldError", () => {
    const error = new AuthzError("FORBIDDEN", "Role 'member' is not permitted.");
    const fieldError = authzErrorToFieldError(error);

    expect(fieldError).toEqual({
      field: "auth",
      code: "FORBIDDEN",
      message: "Role 'member' is not permitted.",
    });
  });
});
