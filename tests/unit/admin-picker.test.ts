import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPreviouslyAssignedBatchAdmins,
  searchUsers,
} from "@/lib/services/user-search";
import {
  getPreviouslyAssignedBatchAdminsAction,
  searchUsersAction,
  createBatchAction,
} from "@/actions/batch";
import * as authorizeModule from "@/lib/auth/authorize";
import * as batchService from "@/lib/services/batch";

// Mock DB for user-search service tests
const {
  mockSelectDistinct,
  mockSelect,
  mockFrom,
} = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const createJoinStep = () => {
    const step: { innerJoin: ReturnType<typeof vi.fn>; where: typeof mockWhere } = {
      innerJoin: vi.fn(),
      where: mockWhere,
    };
    step.innerJoin.mockImplementation(() => step);
    return step;
  };

  const mockFrom = vi.fn().mockImplementation(() => createJoinStep());
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockSelectDistinct = vi.fn().mockReturnValue({ from: mockFrom });

  return {
    mockFrom,
    mockSelect,
    mockSelectDistinct,
  };
});

vi.mock("@/db", () => {
  return {
    db: {
      select: mockSelect,
      selectDistinct: mockSelectDistinct,
    },
  };
});

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

vi.mock("@/lib/services/batch", () => ({
  createBatch: vi.fn(),
  BatchError: class BatchError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "BatchError";
    }
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("User Search Service - getPreviouslyAssignedBatchAdmins & searchUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves previously assigned batch admins with joined user and profile data", async () => {
    const mockPreviousAdmins = [
      {
        id: "profile-1",
        firstName: "Aisha",
        fatherName: "Mohammed",
        userName: "Aisha Mohammed",
        email: "aisha@example.com",
        role: "batch_admin",
      },
      {
        id: "profile-2",
        firstName: "Fatima",
        fatherName: "Ahmed",
        userName: "Fatima Ahmed",
        email: "fatima@example.com",
        role: "member",
      },
    ];

    mockFrom.mockReturnValueOnce({
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockResolvedValue(mockPreviousAdmins),
      }),
    });

    const result = await getPreviouslyAssignedBatchAdmins();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "profile-1",
      name: "Aisha Mohammed",
      email: "aisha@example.com",
      role: "batch_admin",
    });
    expect(result[1]).toEqual({
      id: "profile-2",
      name: "Fatima Ahmed",
      email: "fatima@example.com",
      role: "member",
    });
  });

  it("searches users by query pattern with a maximum limit of 20", async () => {
    const mockSearchResults = [
      {
        id: "profile-3",
        firstName: "Maryam",
        fatherName: "Ali",
        userName: "Maryam Ali",
        email: "maryam@example.com",
        role: "member",
      },
    ];

    const limitMock = vi.fn().mockResolvedValue(mockSearchResults);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    mockFrom.mockReturnValueOnce({ innerJoin: innerJoinMock });

    const result = await searchUsers("Maryam");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "profile-3",
      name: "Maryam Ali",
      email: "maryam@example.com",
      role: "member",
    });
    expect(limitMock).toHaveBeenCalledWith(20);
  });

  it("returns empty array when search query is empty or whitespace", async () => {
    const resultEmpty = await searchUsers("");
    const resultWhitespace = await searchUsers("   ");

    expect(resultEmpty).toEqual([]);
    expect(resultWhitespace).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

describe("AdminPicker Server Actions - Authorization & Execution", () => {
  const superAdminProfileId = "super-admin-uuid";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permits Super Admin to fetch previously assigned batch admins", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: superAdminProfileId,
        authUserId: "auth-super-1",
        role: "super_admin",
        firstName: "Super",
        fatherName: "Admin",
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const mockAdmins = [
      {
        id: "profile-1",
        firstName: "Aisha",
        fatherName: "Mohammed",
        userName: "Aisha Mohammed",
        email: "aisha@example.com",
        role: "batch_admin",
      },
    ];

    mockFrom.mockReturnValueOnce({
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockResolvedValue(mockAdmins),
      }),
    });

    const res = await getPreviouslyAssignedBatchAdminsAction();

    expect(res.ok).toBe(true);
    if (res.ok && res.data) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe("Aisha Mohammed");
    }
    expect(authorizeModule.requireRole).toHaveBeenCalledWith(["super_admin"]);
  });

  it("permits Super Admin to search all users", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: superAdminProfileId,
        authUserId: "auth-super-1",
        role: "super_admin",
        firstName: "Super",
        fatherName: "Admin",
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const mockSearchResults = [
      {
        id: "profile-3",
        firstName: "Maryam",
        fatherName: "Ali",
        userName: "Maryam Ali",
        email: "maryam@example.com",
        role: "member",
      },
    ];

    const limitMock = vi.fn().mockResolvedValue(mockSearchResults);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    mockFrom.mockReturnValueOnce({ innerJoin: innerJoinMock });

    const res = await searchUsersAction("Maryam");

    expect(res.ok).toBe(true);
    if (res.ok && res.data) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].email).toBe("maryam@example.com");
    }
    expect(authorizeModule.requireRole).toHaveBeenCalledWith(["super_admin"]);
  });

  it("rejects non-Super Admin from searching users or accessing previous admins", async () => {
    vi.mocked(authorizeModule.requireRole).mockRejectedValue(
      new authorizeModule.AuthzError("FORBIDDEN", "Role 'member' is not permitted.")
    );

    await expect(searchUsersAction("test")).rejects.toThrow("Role 'member' is not permitted.");
    await expect(getPreviouslyAssignedBatchAdminsAction()).rejects.toThrow("Role 'member' is not permitted.");
  });
});

describe("AdminPicker Integration with Create Batch Form Submission", () => {
  const superAdminProfileId = "super-admin-uuid";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits 1 to 3 selected admin IDs from FormData to createBatchAction", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: superAdminProfileId,
        authUserId: "auth-super-1",
        role: "super_admin",
        firstName: "Super",
        fatherName: "Admin",
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const admin1 = "11111111-1111-4111-8111-111111111111";
    const admin2 = "22222222-2222-4222-8222-222222222222";

    vi.mocked(batchService.createBatch).mockResolvedValue({
      batch: {
        id: "batch-1",
        name: "New Cohort",
        maxMembers: 50,
        paceGroupCount: 1,
        registrationOpen: false,
        autoApprove: true,
        startDate: "2026-09-01",
        readingDaysPerWeek: 6,
        createdBy: superAdminProfileId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      assignedAdminIds: [admin1, admin2],
    });

    const formData = new FormData();
    formData.append("name", "New Cohort");
    formData.append("maxMembers", "50");
    formData.append("paceGroupCount", "1");
    formData.append("startDate", "2026-09-01");
    formData.append("readingDaysPerWeek", "6");
    formData.append("adminIds", admin1);
    formData.append("adminIds", admin2);

    await createBatchAction(null, formData);

    expect(batchService.createBatch).toHaveBeenCalledWith(
      superAdminProfileId,
      expect.objectContaining({
        name: "New Cohort",
        maxMembers: 50,
        paceGroupCount: 1,
        readingDaysPerWeek: 6,
        adminIds: [admin1, admin2],
      })
    );
  });

  it("rejects batch creation when more than 3 admins are provided", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: superAdminProfileId,
        authUserId: "auth-super-1",
        role: "super_admin",
        firstName: "Super",
        fatherName: "Admin",
        grandfatherName: null,
        telegramUsername: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const formData = new FormData();
    formData.append("name", "Too Many Admins Batch");
    formData.append("maxMembers", "50");
    formData.append("paceGroupCount", "1");
    formData.append("startDate", "2026-09-01");
    formData.append("readingDaysPerWeek", "6");
    formData.append("adminIds", "11111111-1111-4111-8111-111111111111");
    formData.append("adminIds", "22222222-2222-4222-8222-222222222222");
    formData.append("adminIds", "33333333-3333-4333-8333-333333333333");
    formData.append("adminIds", "44444444-4444-4444-8444-444444444444"); // 4th admin

    const res = await createBatchAction(null, formData);

    expect(res?.ok).toBe(false);
    if (res && !res.ok && res.errors) {
      expect(res.errors.fieldErrors).toHaveProperty("adminIds");
      expect(res.errors.fieldErrors.adminIds[0]).toContain("At most 3 batch admins can be assigned");
    }
    expect(batchService.createBatch).not.toHaveBeenCalled();
  });
});
