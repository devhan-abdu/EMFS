import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApplication, ApplicationError } from "./application";
import { createApplicationSchema, paceGroupPreferenceSchema } from "@/lib/validations/application";

// Mock the db module
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        batches: {
          findFirst: vi.fn(),
        },
        applications: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn(),
    },
  };
});

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
  });

  const validAppInput = {
    registrationName: "Jane Doe",
    email: "jane@example.com",
    telegramUsername: "janedoe",
    phoneNumber: "+9876543210",
    batchId: "123e4567-e89b-12d3-a456-426614174000",
    paceGroup: "20" as const,
  };

  it("creates an application successfully when input email matches auth email", async () => {
    vi.mocked(db.query.batches.findFirst).mockResolvedValue({
      id: validAppInput.batchId,
      name: "Batch 1",
      maxMembers: 50,
      paceGroupCount: 4,
      registrationOpen: true,
      createdBy: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.query.applications.findFirst).mockResolvedValue(undefined);

    const insertedRecord = {
      id: "app-123",
      userId: "profile-123",
      ...validAppInput,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const returningMock = vi.fn().mockResolvedValue([insertedRecord]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof db.insert>);

    const result = await createApplication("profile-123", "jane@example.com", validAppInput);

    expect(result).toEqual(insertedRecord);
    expect(db.insert).toHaveBeenCalled();
  });

  it("REJECTS application when submitted email does not match authenticated user email", async () => {
    await expect(
      createApplication("profile-123", "actual_user@example.com", {
        ...validAppInput,
        email: "spoofed@example.com",
      })
    ).rejects.toThrow(ApplicationError);

    await expect(
      createApplication("profile-123", "actual_user@example.com", {
        ...validAppInput,
        email: "spoofed@example.com",
      })
    ).rejects.toThrow("Submitted email does not match authenticated user email.");
  });

  it("throws ApplicationError if batch is not found", async () => {
    vi.mocked(db.query.batches.findFirst).mockResolvedValue(undefined);

    await expect(
      createApplication("profile-123", "jane@example.com", validAppInput)
    ).rejects.toThrow("Batch with ID '123e4567-e89b-12d3-a456-426614174000' not found.");
  });

  it("throws ApplicationError if user has already applied for this batch", async () => {
    vi.mocked(db.query.batches.findFirst).mockResolvedValue({
      id: validAppInput.batchId,
      name: "Batch 1",
      maxMembers: 50,
      paceGroupCount: 4,
      registrationOpen: true,
      createdBy: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.query.applications.findFirst).mockResolvedValue({
      id: "existing-app-id",
      userId: "profile-123",
      ...validAppInput,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createApplication("profile-123", "jane@example.com", validAppInput)
    ).rejects.toThrow("User has already submitted an application for this batch.");
  });
});
