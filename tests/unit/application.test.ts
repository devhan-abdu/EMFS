import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApplication } from "@/lib/services/application";
import { createApplicationSchema, paceGroupPreferenceSchema } from "@/lib/validations/application";
import { applications } from "@/db/schema/applications";
import { getTableConfig } from "drizzle-orm/pg-core";

// Mock the db module
vi.mock("@/db", () => {
  return {
    db: {
      transaction: vi.fn((cb) => cb(dbTx)),
      query: {
        batches: {
          findFirst: vi.fn(),
        },
        batchMemberships: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn(),
    },
  };
});

const dbTx = {
  query: {
    batches: {
      findFirst: vi.fn(),
    },
    batchMemberships: {
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn(),
};

import { db } from "@/db";

describe("Application Validation Schema", () => {
  const validPayload = {
    registrationName: "John Doe",
    email: "john@example.com",
    telegramUsername: "johndoe",
    phoneNumber: "+1234567890",
    batchId: "123e4567-e89b-12d3-a456-426614174000",
    paceGroup: "10" as const,
  };

  it("validates correct application input", () => {
    const parsed = createApplicationSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("accepts Telegram username without @ symbol", () => {
    const parsed = createApplicationSchema.safeParse({
      ...validPayload,
      telegramUsername: "user_without_at",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid pace_group values", () => {
    const parsed = createApplicationSchema.safeParse({
      ...validPayload,
      paceGroup: "15", // Not in 5, 10, 20, 40
    });
    expect(parsed.success).toBe(false);
  });

  it("validates exact allowed pace_group values (5, 10, 20, 40)", () => {
    expect(paceGroupPreferenceSchema.safeParse("5").success).toBe(true);
    expect(paceGroupPreferenceSchema.safeParse("10").success).toBe(true);
    expect(paceGroupPreferenceSchema.safeParse("20").success).toBe(true);
    expect(paceGroupPreferenceSchema.safeParse("40").success).toBe(true);
    expect(paceGroupPreferenceSchema.safeParse("30").success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(
      createApplicationSchema.safeParse({ ...validPayload, registrationName: "" }).success
    ).toBe(false);

    expect(
      createApplicationSchema.safeParse({ ...validPayload, email: "not-an-email" }).success
    ).toBe(false);

    expect(
      createApplicationSchema.safeParse({ ...validPayload, phoneNumber: "" }).success
    ).toBe(false);

    expect(
      createApplicationSchema.safeParse({ ...validPayload, batchId: "not-a-uuid" }).success
    ).toBe(false);
  });
});

describe("Application Service - createApplication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.transaction).mockImplementation((cb: unknown) =>
      (cb as (tx: unknown) => unknown)(dbTx) as never
    );
  });

  const validAppInput = {
    registrationName: "Jane Doe",
    email: "jane@example.com",
    telegramUsername: "janedoe",
    phoneNumber: "+9876543210",
    batchId: "123e4567-e89b-12d3-a456-426614174000",
    paceGroup: "20" as const,
  };

  it("creates an application and batch membership with 'applied' status when user has no active membership", async () => {
    vi.mocked(dbTx.query.batches.findFirst).mockResolvedValue({
      id: validAppInput.batchId,
      name: "Batch 1",
      maxMembers: 50,
      paceGroupCount: 4,
      registrationOpen: true,
      createdBy: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // No non-terminal membership
    vi.mocked(dbTx.query.batchMemberships.findFirst).mockResolvedValue(undefined);

    const insertedRecord = {
      id: "app-123",
      userId: "profile-123",
      ...validAppInput,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertedMembership = {
      id: "mem-123",
      profileId: "profile-123",
      batchId: validAppInput.batchId,
      status: "applied",
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    let insertCallCount = 0;
    vi.mocked(dbTx.insert).mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        // Application insert with onConflictDoUpdate
        return {
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([insertedRecord]),
            }),
          }),
        } as unknown as ReturnType<typeof dbTx.insert>;
      }
      // Membership insert
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedMembership]),
        }),
      } as unknown as ReturnType<typeof dbTx.insert>;
    });

    const result = await createApplication("profile-123", "jane@example.com", validAppInput);

    expect(result).toEqual(insertedRecord);
    expect(dbTx.insert).toHaveBeenCalledTimes(2);
  });

  it("REJECTS application when submitted email does not match authenticated user email", async () => {
    await expect(
      createApplication("profile-123", "actual_user@example.com", {
        ...validAppInput,
        email: "spoofed@example.com",
      })
    ).rejects.toThrow("Submitted email does not match authenticated user email.");
  });

  it("throws ApplicationError if batch is not found", async () => {
    vi.mocked(dbTx.query.batches.findFirst).mockResolvedValue(undefined);

    await expect(
      createApplication("profile-123", "jane@example.com", validAppInput)
    ).rejects.toThrow("Batch with ID '123e4567-e89b-12d3-a456-426614174000' not found.");
  });

  it("REJECTS duplicate application when user currently has a non-terminal membership", async () => {
    vi.mocked(dbTx.query.batches.findFirst).mockResolvedValue({
      id: validAppInput.batchId,
      name: "Batch 1",
      maxMembers: 50,
      paceGroupCount: 4,
      registrationOpen: true,
      createdBy: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // User already has a non-terminal membership (e.g. status: "applied")
    vi.mocked(dbTx.query.batchMemberships.findFirst).mockResolvedValue({
      id: "mem-active",
      profileId: "profile-123",
      batchId: validAppInput.batchId,
      status: "applied",
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    });

    await expect(
      createApplication("profile-123", "jane@example.com", validAppInput)
    ).rejects.toThrow("User has already submitted an application for this batch.");
  });

  it("ALLOWS re-application when user membership is in a terminal status ('rejected')", async () => {
    vi.mocked(dbTx.query.batches.findFirst).mockResolvedValue({
      id: validAppInput.batchId,
      name: "Batch 1",
      maxMembers: 50,
      paceGroupCount: 4,
      registrationOpen: true,
      createdBy: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // NON_TERMINAL_STATUSES filter returns undefined when existing membership is "rejected"
    vi.mocked(dbTx.query.batchMemberships.findFirst).mockResolvedValue(undefined);

    const updatedAppRecord = {
      id: "app-123",
      userId: "profile-123",
      ...validAppInput,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newMembership = {
      id: "mem-new",
      profileId: "profile-123",
      batchId: validAppInput.batchId,
      status: "applied",
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    let insertCallCount = 0;
    vi.mocked(dbTx.insert).mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return {
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updatedAppRecord]),
            }),
          }),
        } as unknown as ReturnType<typeof dbTx.insert>;
      }
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newMembership]),
        }),
      } as unknown as ReturnType<typeof dbTx.insert>;
    });

    const result = await createApplication("profile-123", "jane@example.com", validAppInput);

    expect(result).toEqual(updatedAppRecord);
    expect(dbTx.insert).toHaveBeenCalledTimes(2);
  });

  it("ALLOWS re-application when user membership is in a terminal status ('removed')", async () => {
    vi.mocked(dbTx.query.batches.findFirst).mockResolvedValue({
      id: validAppInput.batchId,
      name: "Batch 1",
      maxMembers: 50,
      paceGroupCount: 4,
      registrationOpen: true,
      createdBy: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(dbTx.query.batchMemberships.findFirst).mockResolvedValue(undefined);

    const updatedAppRecord = {
      id: "app-123",
      userId: "profile-123",
      ...validAppInput,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newMembership = {
      id: "mem-new-2",
      profileId: "profile-123",
      batchId: validAppInput.batchId,
      status: "applied",
      startDate: new Date(),
      endDate: null,
      removalReason: null,
      createdAt: new Date(),
    };

    let insertCallCount = 0;
    vi.mocked(dbTx.insert).mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return {
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updatedAppRecord]),
            }),
          }),
        } as unknown as ReturnType<typeof dbTx.insert>;
      }
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newMembership]),
        }),
      } as unknown as ReturnType<typeof dbTx.insert>;
    });

    const result = await createApplication("profile-123", "jane@example.com", validAppInput);

    expect(result).toEqual(updatedAppRecord);
  });
});

describe("Applications Schema Index Verification", () => {
  it("verifies applications.batchId index and unique_user_batch_application_idx exist", () => {
    const config = getTableConfig(applications);
    const indexNames = config.indexes.map((idx) => idx.config.name);

    expect(indexNames).toContain("applications_batch_id_idx");
    expect(indexNames).toContain("unique_user_batch_application_idx");
  });
});
