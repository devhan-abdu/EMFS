import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateHandoffCode,
  createHandoffRecord,
  markHandoffUsed,
  HandoffError,
} from "@/lib/services/handoff";

// Mock the db module
vi.mock("@/db", () => {
  return {
    db: {
      transaction: vi.fn((cb) => cb(db)),
      query: {
        applications: {
          findFirst: vi.fn(),
        },
        handoffRecords: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn(),
      update: vi.fn(),
    },
  };
});

import { db } from "@/db";

describe("Handoff Service - Code Generation", () => {
  it("9. generated code has expected length and alphanumeric format", () => {
    const code = generateHandoffCode(6);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[0-9A-Z]{6}$/);
  });

  it("10. code is generated using secure server-side randomness and produces distinct values", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateHandoffCode(6)));
    // Expect high variance across 50 generated codes
    expect(codes.size).toBeGreaterThan(45);
  });
});

describe("Handoff Service - Persistence & Security", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.transaction).mockImplementation((cb: unknown) =>
      (cb as (tx: unknown) => unknown)(db) as never
    );
  });

  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("1. creates a handoff record, 2. stores application_id, 3. stores code, 5. sets issued_at, 6. leaves used_at null initially, 8. no Telegram URL persisted", async () => {
    vi.mocked(db.query.applications.findFirst).mockResolvedValue({
      id: validUuid,
      userId: "user-1",
      batchId: "batch-1",
      registrationName: "John Doe",
      email: "john@example.com",
      telegramUsername: "@johndoe",
      phoneNumber: "+251911000000",
      paceGroup: "10",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.query.handoffRecords.findFirst).mockResolvedValue(undefined);

    const mockHandoff = {
      id: "handoff-uuid-1",
      applicationId: validUuid,
      code: "ABC123",
      issuedAt: new Date(),
      usedAt: null,
      telegramChatId: null,
    };

    const returningMock = vi.fn().mockResolvedValue([mockHandoff]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof db.insert>);

    const result = await createHandoffRecord({ applicationId: validUuid });

    expect(result.applicationId).toBe(validUuid);
    expect(result.code).toBe("ABC123");
    expect(result.issuedAt).toBeInstanceOf(Date);
    expect(result.usedAt).toBeNull();

    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues).not.toHaveProperty("telegram_invite_link");
    expect(insertedValues).not.toHaveProperty("invite_url");
    expect(insertedValues).not.toHaveProperty("adminContactShown");
  });

  it("throws HandoffError when application is not found", async () => {
    vi.mocked(db.query.applications.findFirst).mockResolvedValue(undefined);

    await expect(
      createHandoffRecord({ applicationId: validUuid })
    ).rejects.toThrow(HandoffError);
  });

  it("throws HandoffError if applicationId is invalid UUID", async () => {
    await expect(
      createHandoffRecord({ applicationId: "non-existent-app" })
    ).rejects.toThrow("Invalid application ID.");
  });

  it("retries on first code collision and succeeds", async () => {
    vi.mocked(db.query.applications.findFirst).mockResolvedValue({ id: validUuid } as never);
    vi.mocked(db.query.handoffRecords.findFirst).mockResolvedValue(undefined);

    const collisionError = new Error("Unique constraint failed") as Error & { code: string };
    collisionError.code = "23505";
    collisionError.message = "duplicate key value violates unique constraint \"unique_handoff_code_idx\"";

    const mockHandoff = {
      id: "handoff-uuid-1",
      applicationId: validUuid,
      code: "NEW123",
      issuedAt: new Date(),
      usedAt: null,
      telegramChatId: null,
    };

    let insertCount = 0;
    const valuesMock = vi.fn().mockImplementation(() => {
      insertCount++;
      if (insertCount === 1) {
        throw collisionError;
      }
      return { returning: vi.fn().mockResolvedValue([mockHandoff]) };
    });
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof db.insert>);

    const result = await createHandoffRecord({ applicationId: validUuid });

    expect(insertCount).toBe(2);
    expect(result.code).toBe("NEW123");
  });

  it("fails after reaching max retries for code collisions", async () => {
    vi.mocked(db.query.applications.findFirst).mockResolvedValue({ id: validUuid } as never);
    vi.mocked(db.query.handoffRecords.findFirst).mockResolvedValue(undefined);

    const collisionError = new Error("Unique constraint failed") as Error & { code: string };
    collisionError.code = "23505";
    collisionError.message = "duplicate key value violates unique constraint \"unique_handoff_code_idx\"";

    const valuesMock = vi.fn().mockImplementation(() => {
      throw collisionError;
    });
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof db.insert>);

    await expect(
      createHandoffRecord({ applicationId: validUuid })
    ).rejects.toThrow("Failed to generate a unique handoff code after multiple attempts.");

    expect(valuesMock).toHaveBeenCalledTimes(3);
  });

  it("does not incorrectly retry other database errors", async () => {
    vi.mocked(db.query.applications.findFirst).mockResolvedValue({ id: validUuid } as never);
    vi.mocked(db.query.handoffRecords.findFirst).mockResolvedValue(undefined);

    const otherError = new Error("Connection failed") as Error & { code: string };
    otherError.code = "08006";

    const valuesMock = vi.fn().mockImplementation(() => {
      throw otherError;
    });
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof db.insert>);

    await expect(
      createHandoffRecord({ applicationId: validUuid })
    ).rejects.toThrow("Connection failed");

    expect(valuesMock).toHaveBeenCalledTimes(1);
  });
});

describe("Handoff Service - markHandoffUsed", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("successfully marks an unused handoff as used", async () => {
    const handoffId = "handoff-uuid-1";
    const initialHandoff = {
      id: handoffId,
      applicationId: "app-1",
      code: "XYZ789",
      issuedAt: new Date(),
      usedAt: null,
      telegramChatId: null,
    };

    vi.mocked(db.query.handoffRecords.findFirst).mockResolvedValue(initialHandoff);

    const updatedHandoff = { ...initialHandoff, usedAt: new Date() };
    const returningMock = vi.fn().mockResolvedValue([updatedHandoff]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as unknown as ReturnType<typeof db.update>);

    const result = await markHandoffUsed(handoffId);
    expect(result.usedAt).toBeInstanceOf(Date);
  });

  it("throws error when trying to mark an already used handoff", async () => {
    const handoffId = "handoff-uuid-1";
    const pastDate = new Date(Date.now() - 10000);
    const initialHandoff = {
      id: handoffId,
      applicationId: "app-1",
      code: "XYZ789",
      issuedAt: new Date(Date.now() - 20000),
      usedAt: pastDate,
      telegramChatId: null,
    };

    vi.mocked(db.query.handoffRecords.findFirst).mockResolvedValue(initialHandoff);

    await expect(markHandoffUsed(handoffId)).rejects.toThrow(
      "has already been used."
    );

    expect(db.update).not.toHaveBeenCalled();
  });
});
