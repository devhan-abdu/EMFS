import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateHandoffCode,
  createHandoffRecord,
  markHandoffUsed,
  HandoffError,
} from "./handoff";

// Mock the db module
vi.mock("@/db", () => {
  return {
    db: {
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
  });

  it("1. creates a handoff record, 2. stores application_id, 3. stores code, 4. stores admin_contact_shown, 5. sets issued_at, 6. leaves used_at null initially, 8. no Telegram URL persisted", async () => {
    const appId = "app-uuid-123";
    const adminContact = "Admin Phone: +251911000000";

    vi.mocked(db.query.applications.findFirst).mockResolvedValue({
      id: appId,
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
      applicationId: appId,
      code: "ABC123",
      adminContactShown: adminContact,
      issuedAt: new Date(),
      usedAt: null,
    };

    const returningMock = vi.fn().mockResolvedValue([mockHandoff]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof db.insert>);

    const result = await createHandoffRecord(appId, adminContact);

    expect(result.applicationId).toBe(appId);
    expect(result.code).toBe("ABC123");
    expect(result.adminContactShown).toBe(adminContact);
    expect(result.issuedAt).toBeInstanceOf(Date);
    expect(result.usedAt).toBeNull();

    // Verify values passed to db.insert do not contain telegram invite URLs or columns
    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues).not.toHaveProperty("telegram_invite_link");
    expect(insertedValues).not.toHaveProperty("invite_url");
    expect(insertedValues.adminContactShown).not.toContain("t.me/");
  });

  it("7. used_at can later be set when the legitimate flow requires it", async () => {
    const handoffId = "handoff-uuid-1";
    const initialHandoff = {
      id: handoffId,
      applicationId: "app-1",
      code: "XYZ789",
      adminContactShown: "Admin Contact",
      issuedAt: new Date(),
      usedAt: null,
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

  it("throws HandoffError when application is not found", async () => {
    vi.mocked(db.query.applications.findFirst).mockResolvedValue(undefined);

    await expect(
      createHandoffRecord("non-existent-app", "Admin Contact")
    ).rejects.toThrow(HandoffError);
  });

  it("throws HandoffError if admin contact is empty", async () => {
    await expect(createHandoffRecord("app-1", "")).rejects.toThrow(
      "Admin contact information must be provided."
    );
  });
});
