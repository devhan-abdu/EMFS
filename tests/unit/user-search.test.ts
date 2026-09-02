import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchProfiles,
  listKnownBatchAdmins,
  UserSearchError,
} from "@/lib/services/user-search";
import { searchProfilesSchema } from "@/lib/validations/user-search";
import {
  searchProfilesAction,
  listKnownBatchAdminsAction,
} from "@/actions/user-search";
import * as authorizeModule from "@/lib/auth/authorize";

// Mock DB for user-search service tests
const {
  mockSelect,
  mockLimit,
  mockWhere,
  mockOrderBy,
} = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });

  const createJoinStep = () => {
    const step: {
      innerJoin: ReturnType<typeof vi.fn>;
      where: typeof mockWhere;
      orderBy: typeof mockOrderBy;
    } = {
      innerJoin: vi.fn(),
      where: mockWhere,
      orderBy: mockOrderBy,
    };
    step.innerJoin.mockImplementation(() => step);
    return step;
  };

  const mockFrom = vi.fn().mockImplementation(() => createJoinStep());
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  return {
    mockSelect,
    mockLimit,
    mockWhere,
    mockOrderBy,
  };
});

vi.mock("@/db", () => {
  return {
    db: {
      select: mockSelect,
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

describe("EMF-58: User Search Service - searchProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matched profiles by display name (first name + father name)", async () => {
    const mockRows = [
      {
        id: "profile-1111-1111-1111-111111111111",
        firstName: "Fatima",
        fatherName: "Zahra",
        userName: null,
        email: "fatima@example.com",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockRows);

    const result = await searchProfiles({ query: "Fatima" });

    expect(result).toEqual([
      {
        profileId: "profile-1111-1111-1111-111111111111",
        displayName: "Fatima Zahra",
        email: "fatima@example.com",
      },
    ]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns matched profiles by user.name when present", async () => {
    const mockRows = [
      {
        id: "profile-2222-2222-2222-222222222222",
        firstName: "Aisha",
        fatherName: "Ali",
        userName: "Aisha A.",
        email: "aisha@example.com",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockRows);

    const result = await searchProfiles({ query: "Aisha" });

    expect(result).toEqual([
      {
        profileId: "profile-2222-2222-2222-222222222222",
        displayName: "Aisha A.",
        email: "aisha@example.com",
      },
    ]);
  });

  it("matches on email", async () => {
    const mockRows = [
      {
        id: "profile-3333-3333-3333-333333333333",
        firstName: "Khadija",
        fatherName: "Omar",
        userName: "Khadija Omar",
        email: "khadija.special@domain.org",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockRows);

    const result = await searchProfiles({ query: "special@domain" });

    expect(result).toEqual([
      {
        profileId: "profile-3333-3333-3333-333333333333",
        displayName: "Khadija Omar",
        email: "khadija.special@domain.org",
      },
    ]);
  });

  it("performs case-insensitive search queries", async () => {
    const mockRows = [
      {
        id: "profile-4444-4444-4444-444444444444",
        firstName: "Maryam",
        fatherName: "Ibrahim",
        userName: "Maryam Ibrahim",
        email: "MARYAM@EXAMPLE.COM",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockRows);

    const resultLower = await searchProfiles({ query: "maryam" });
    expect(resultLower).toHaveLength(1);
    expect(resultLower[0].displayName).toBe("Maryam Ibrahim");
  });

  it("returns profiles regardless of their role (member, pace_admin, batch_admin, super_admin)", async () => {
    const mockRows = [
      {
        id: "profile-member",
        firstName: "Member",
        fatherName: "One",
        userName: "Member One",
        email: "member@example.com",
      },
      {
        id: "profile-pace",
        firstName: "Pace",
        fatherName: "Admin",
        userName: "Pace Admin",
        email: "pace@example.com",
      },
      {
        id: "profile-batch",
        firstName: "Batch",
        fatherName: "Admin",
        userName: "Batch Admin",
        email: "batch@example.com",
      },
      {
        id: "profile-super",
        firstName: "Super",
        fatherName: "Admin",
        userName: "Super Admin",
        email: "super@example.com",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockRows);

    const result = await searchProfiles({ query: "admin" });

    expect(result).toHaveLength(4);
    expect(result.map((r) => r.profileId)).toEqual([
      "profile-member",
      "profile-pace",
      "profile-batch",
      "profile-super",
    ]);
  });

  it("does not exclude profiles that were previously batch admins", async () => {
    const mockRows = [
      {
        id: "previous-admin-profile",
        firstName: "Prev",
        fatherName: "Admin",
        userName: "Prev Admin",
        email: "prevadmin@example.com",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockRows);

    const result = await searchProfiles({ query: "Prev" });

    expect(result).toHaveLength(1);
    expect(result[0].profileId).toBe("previous-admin-profile");
  });

  it("supports excludeProfileIds to filter out specific profiles", async () => {
    const mockRows = [
      {
        id: "profile-keep",
        firstName: "Keep",
        fatherName: "Me",
        userName: "Keep Me",
        email: "keep@example.com",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockRows);

    const excludedIds = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ];

    const result = await searchProfiles({
      query: "Keep",
      excludeProfileIds: excludedIds,
    });

    expect(result).toHaveLength(1);
    expect(result[0].profileId).toBe("profile-keep");
    expect(mockWhere).toHaveBeenCalled();
  });

  it("rejects queries shorter than 2 characters with UserSearchError", async () => {
    await expect(searchProfiles({ query: "" })).rejects.toThrow(
      "Search query must be at least 2 characters."
    );
    await expect(searchProfiles({ query: "" })).rejects.toThrowError(UserSearchError);
    await expect(searchProfiles({ query: "a" })).rejects.toThrow(
      "Search query must be at least 2 characters."
    );
    await expect(searchProfiles({ query: "   " })).rejects.toThrow(
      "Search query must be at least 2 characters."
    );
    await expect(searchProfiles("b")).rejects.toThrow(
      "Search query must be at least 2 characters."
    );
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("caps results at 25 even if a larger limit is requested", async () => {
    mockLimit.mockResolvedValue([]);

    await searchProfiles({ query: "test", limit: 100 });
    expect(mockLimit).toHaveBeenCalledWith(25);

    await searchProfiles({ query: "test", limit: 50 });
    expect(mockLimit).toHaveBeenCalledWith(25);
  });

  it("respects limit when lower than 25", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await searchProfiles({ query: "test", limit: 10 });
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it("defaults limit to 25 when not provided", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await searchProfiles({ query: "test" });
    expect(mockLimit).toHaveBeenCalledWith(25);
  });

  it("strictly returns only { profileId, displayName, email } shape", async () => {
    const mockRows = [
      {
        id: "profile-strict-test",
        firstName: "Strict",
        fatherName: "Shape",
        userName: "Strict Shape",
        email: "strict@example.com",
        role: "super_admin",
        createdAt: new Date(),
        authUserId: "auth-123",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockRows);

    const result = await searchProfiles({ query: "Strict" });

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(Object.keys(item).sort()).toEqual(["displayName", "email", "profileId"]);
    expect(item).toEqual({
      profileId: "profile-strict-test",
      displayName: "Strict Shape",
      email: "strict@example.com",
    });
    expect((item as Record<string, unknown>).role).toBeUndefined();
    expect((item as Record<string, unknown>).authUserId).toBeUndefined();
  });
});

describe("EMF-58: Validation Schema - searchProfilesSchema", () => {
  it("validates valid search input", () => {
    const valid = {
      query: "Alice",
      limit: 15,
      excludeProfileIds: ["11111111-1111-4111-8111-111111111111"],
    };
    const parsed = searchProfilesSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.query).toBe("Alice");
      expect(parsed.data.limit).toBe(15);
      expect(parsed.data.excludeProfileIds).toEqual([
        "11111111-1111-4111-8111-111111111111",
      ]);
    }
  });

  it("applies default limit 25 and default empty excludeProfileIds", () => {
    const parsed = searchProfilesSchema.safeParse({ query: "Bob" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
      expect(parsed.data.excludeProfileIds).toEqual([]);
    }
  });

  it("fails when query is less than 2 characters", () => {
    const emptyParsed = searchProfilesSchema.safeParse({ query: "" });
    expect(emptyParsed.success).toBe(false);

    const singleCharParsed = searchProfilesSchema.safeParse({ query: "a" });
    expect(singleCharParsed.success).toBe(false);

    const spacesParsed = searchProfilesSchema.safeParse({ query: "   " });
    expect(spacesParsed.success).toBe(false);
  });

  it("fails when excludeProfileIds contains invalid UUID", () => {
    const parsed = searchProfilesSchema.safeParse({
      query: "test",
      excludeProfileIds: ["not-a-uuid"],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("EMF-58: Server Action - searchProfilesAction Authorization & Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes and succeeds when super_admin calls searchProfilesAction", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: "super-profile-id",
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

    const mockResults = [
      {
        id: "profile-found-1",
        firstName: "Zeinab",
        fatherName: "Hassan",
        userName: "Zeinab Hassan",
        email: "zeinab@example.com",
      },
    ];
    mockLimit.mockResolvedValueOnce(mockResults);

    const res = await searchProfilesAction({ query: "Zeinab" });

    expect(res.ok).toBe(true);
    if (res.ok && res.data) {
      expect(res.data).toEqual([
        {
          profileId: "profile-found-1",
          displayName: "Zeinab Hassan",
          email: "zeinab@example.com",
        },
      ]);
    }
    expect(authorizeModule.requireRole).toHaveBeenCalledWith(["super_admin"]);
  });

  it("supports string query input directly in searchProfilesAction", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: "super-profile-id",
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

    mockLimit.mockResolvedValueOnce([]);

    const res = await searchProfilesAction("Zeinab");
    expect(res.ok).toBe(true);
  });

  it("returns validation error when query is less than 2 characters in searchProfilesAction", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: "super-profile-id",
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

    const res = await searchProfilesAction({ query: "a" });
    expect(res.ok).toBe(false);
    if (!res.ok && res.errors) {
      expect(res.errors.fieldErrors).toHaveProperty("query");
    }
  });

  it("rejects non-super_admin callers (member, batch_admin, pace_admin, unauthenticated)", async () => {
    vi.mocked(authorizeModule.requireRole).mockRejectedValue(
      new authorizeModule.AuthzError(
        "FORBIDDEN",
        "Role 'batch_admin' is not permitted. Required at least: super_admin."
      )
    );

    await expect(searchProfilesAction({ query: "test" })).rejects.toThrow(
      "Role 'batch_admin' is not permitted"
    );
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

describe("Backend: list known batch admins - listKnownBatchAdmins & listKnownBatchAdminsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile with one batch_admins row and its batch info", async () => {
    const mockRows = [
      {
        profileId: "p-1",
        firstName: "Aisha",
        fatherName: "Mohammed",
        userName: "Aisha Mohammed",
        email: "aisha@example.com",
        batchId: "b-1",
        batchName: "Cohort 2026 Alpha",
        assignedAt: new Date("2026-09-01T10:00:00Z"),
      },
    ];
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const result = await listKnownBatchAdmins();

    expect(result).toEqual([
      {
        profileId: "p-1",
        displayName: "Aisha Mohammed",
        email: "aisha@example.com",
        adminOfBatches: [
          {
            id: "b-1",
            name: "Cohort 2026 Alpha",
          },
        ],
      },
    ]);
  });

  it("groups profile with multiple batch_admins rows so the profile appears only once with multiple entries in adminOfBatches", async () => {
    const mockRows = [
      {
        profileId: "p-1",
        firstName: "Fatima",
        fatherName: "Ahmed",
        userName: "Fatima Ahmed",
        email: "fatima@example.com",
        batchId: "b-2",
        batchName: "Cohort 2026 Beta",
        assignedAt: new Date("2026-09-02T12:00:00Z"),
      },
      {
        profileId: "p-1",
        firstName: "Fatima",
        fatherName: "Ahmed",
        userName: "Fatima Ahmed",
        email: "fatima@example.com",
        batchId: "b-1",
        batchName: "Cohort 2026 Alpha",
        assignedAt: new Date("2026-08-01T10:00:00Z"),
      },
    ];
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const result = await listKnownBatchAdmins();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      profileId: "p-1",
      displayName: "Fatima Ahmed",
      email: "fatima@example.com",
      adminOfBatches: [
        {
          id: "b-2",
          name: "Cohort 2026 Beta",
        },
        {
          id: "b-1",
          name: "Cohort 2026 Alpha",
        },
      ],
    });
  });

  it("orders profiles by their most recent batch admin assignment", async () => {
    // p-2 was assigned most recently (Sept 3), then p-1 (Sept 2), then p-3 (Sept 1)
    const mockRows = [
      {
        profileId: "p-2",
        firstName: "Khadija",
        fatherName: "Ali",
        userName: "Khadija Ali",
        email: "khadija@example.com",
        batchId: "b-2",
        batchName: "Cohort 2026 Beta",
        assignedAt: new Date("2026-09-03T10:00:00Z"),
      },
      {
        profileId: "p-1",
        firstName: "Fatima",
        fatherName: "Ahmed",
        userName: "Fatima Ahmed",
        email: "fatima@example.com",
        batchId: "b-1",
        batchName: "Cohort 2026 Alpha",
        assignedAt: new Date("2026-09-02T10:00:00Z"),
      },
      {
        profileId: "p-3",
        firstName: "Maryam",
        fatherName: "Hassan",
        userName: "Maryam Hassan",
        email: "maryam@example.com",
        batchId: "b-3",
        batchName: "Cohort 2026 Gamma",
        assignedAt: new Date("2026-09-01T10:00:00Z"),
      },
      {
        // p-2 also has an older assignment (Aug 15)
        profileId: "p-2",
        firstName: "Khadija",
        fatherName: "Ali",
        userName: "Khadija Ali",
        email: "khadija@example.com",
        batchId: "b-1",
        batchName: "Cohort 2026 Alpha",
        assignedAt: new Date("2026-08-15T10:00:00Z"),
      },
    ];
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const result = await listKnownBatchAdmins();

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.profileId)).toEqual(["p-2", "p-1", "p-3"]);
    expect(result[0].adminOfBatches).toHaveLength(2);
    expect(result[0].adminOfBatches.map((b) => b.id)).toEqual(["b-2", "b-1"]);
  });

  it("does not return profiles without any batch_admins row", async () => {
    // Only profiles joined via batch_admins appear
    mockOrderBy.mockResolvedValueOnce([]);

    const result = await listKnownBatchAdmins();

    expect(result).toEqual([]);
  });

  it("returns maximum 20 distinct profiles", async () => {
    const mockRows = Array.from({ length: 30 }, (_, i) => ({
      profileId: `p-${i + 1}`,
      firstName: `Admin`,
      fatherName: `${i + 1}`,
      userName: `Admin ${i + 1}`,
      email: `admin${i + 1}@example.com`,
      batchId: `b-${i + 1}`,
      batchName: `Batch ${i + 1}`,
      assignedAt: new Date(Date.now() - i * 10000),
    }));
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const result = await listKnownBatchAdmins();

    expect(result).toHaveLength(20);
    expect(result[0].profileId).toBe("p-1");
    expect(result[19].profileId).toBe("p-20");
  });

  it("returns empty array [] when batch_admins table is empty", async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    const result = await listKnownBatchAdmins();

    expect(result).toEqual([]);
  });

  it("permits super_admin to execute listKnownBatchAdminsAction", async () => {
    vi.mocked(authorizeModule.requireRole).mockResolvedValue({
      authUserId: "auth-super-1",
      email: "super@example.com",
      profile: {
        id: "super-profile-id",
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

    const mockRows = [
      {
        profileId: "p-1",
        firstName: "Aisha",
        fatherName: "Mohammed",
        userName: "Aisha Mohammed",
        email: "aisha@example.com",
        batchId: "b-1",
        batchName: "Cohort 2026 Alpha",
        assignedAt: new Date("2026-09-01T10:00:00Z"),
      },
    ];
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const res = await listKnownBatchAdminsAction();

    expect(res.ok).toBe(true);
    if (res.ok && res.data) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].profileId).toBe("p-1");
      expect(res.data[0].adminOfBatches).toEqual([
        { id: "b-1", name: "Cohort 2026 Alpha" },
      ]);
    }
    expect(authorizeModule.requireRole).toHaveBeenCalledWith(["super_admin"]);
  });

  it("rejects non-super_admin callers (member, batch_admin, pace_admin, unauthenticated) from listKnownBatchAdminsAction", async () => {
    vi.mocked(authorizeModule.requireRole).mockRejectedValue(
      new authorizeModule.AuthzError(
        "FORBIDDEN",
        "Role 'batch_admin' is not permitted. Required at least: super_admin."
      )
    );

    await expect(listKnownBatchAdminsAction()).rejects.toThrow(
      "Role 'batch_admin' is not permitted"
    );
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
