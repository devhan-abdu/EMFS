import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addToWaitlist,
  removeFromWaitlist,
  getWaitlistHead,
  getWaitlistQueue,
  WaitlistError,
} from "./waitlist";

// Mock the db module
vi.mock("@/db", () => {
  return {
    db: {
      transaction: vi.fn((cb) => cb(dbTx)),
      select: vi.fn(),
    },
  };
});

const dbTx = {
  query: {
    batches: {
      findFirst: vi.fn(),
    },
    waitlist: {
      findFirst: vi.fn(),
    },
  },
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
};

import { db } from "@/db";

describe("Waitlist Service - addToWaitlist & Queue Ordering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.transaction).mockImplementation((cb: unknown) =>
      (cb as (tx: unknown) => unknown)(dbTx) as never
    );
  });

  const batchId = "batch-uuid-1";
  const userId1 = "user-uuid-1";
  const userId2 = "user-uuid-2";

  it("locks batch FOR UPDATE and creates a waitlist entry with position 1 when queue is empty", async () => {
    // Mock batch select .for("update")
    const forUpdateMock = vi.fn().mockResolvedValue([{ id: batchId }]);
    const whereBatchMock = vi.fn().mockReturnValue({ for: forUpdateMock });
    const fromBatchMock = vi.fn().mockReturnValue({ where: whereBatchMock });

    // Mock max queuePosition select
    const maxPosMock = [{ maxPos: 0 }];
    const whereMaxMock = vi.fn().mockResolvedValue(maxPosMock);
    const fromMaxMock = vi.fn().mockReturnValue({ where: whereMaxMock });

    let selectCallCount = 0;
    vi.mocked(dbTx.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return { from: fromBatchMock } as unknown as ReturnType<typeof dbTx.select>;
      }
      return { from: fromMaxMock } as unknown as ReturnType<typeof dbTx.select>;
    });

    vi.mocked(dbTx.query.waitlist.findFirst).mockResolvedValue(undefined);

    const insertedEntry = {
      id: "wl-1",
      batchId,
      userId: userId1,
      queuePosition: 1,
      joinedAt: new Date(),
    };

    const returningMock = vi.fn().mockResolvedValue([insertedEntry]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    vi.mocked(dbTx.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof dbTx.insert>);

    const result = await addToWaitlist(userId1, batchId);

    expect(result).toEqual(insertedEntry);
    expect(result.queuePosition).toBe(1);
    expect(forUpdateMock).toHaveBeenCalled();
  });

  it("assigns sequential queue_positions (e.g. 2) for subsequent users in the same batch", async () => {
    const forUpdateMock = vi.fn().mockResolvedValue([{ id: batchId }]);
    const whereBatchMock = vi.fn().mockReturnValue({ for: forUpdateMock });
    const fromBatchMock = vi.fn().mockReturnValue({ where: whereBatchMock });

    const maxPosMock = [{ maxPos: 1 }]; // Position 1 exists
    const whereMaxMock = vi.fn().mockResolvedValue(maxPosMock);
    const fromMaxMock = vi.fn().mockReturnValue({ where: whereMaxMock });

    let selectCallCount = 0;
    vi.mocked(dbTx.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return { from: fromBatchMock } as unknown as ReturnType<typeof dbTx.select>;
      }
      return { from: fromMaxMock } as unknown as ReturnType<typeof dbTx.select>;
    });

    vi.mocked(dbTx.query.waitlist.findFirst).mockResolvedValue(undefined);

    const insertedEntry = {
      id: "wl-2",
      batchId,
      userId: userId2,
      queuePosition: 2,
      joinedAt: new Date(),
    };

    const returningMock = vi.fn().mockResolvedValue([insertedEntry]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    vi.mocked(dbTx.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof dbTx.insert>);

    const result = await addToWaitlist(userId2, batchId);

    expect(result.queuePosition).toBe(2);
  });

  it("throws WaitlistError if target batch does not exist", async () => {
    const forUpdateMock = vi.fn().mockResolvedValue([]);
    const whereBatchMock = vi.fn().mockReturnValue({ for: forUpdateMock });
    const fromBatchMock = vi.fn().mockReturnValue({ where: whereBatchMock });

    vi.mocked(dbTx.select).mockReturnValue({ from: fromBatchMock } as unknown as ReturnType<typeof dbTx.select>);

    await expect(addToWaitlist(userId1, "non-existent-batch")).rejects.toThrow(
      WaitlistError
    );
    await expect(addToWaitlist(userId1, "non-existent-batch")).rejects.toThrow(
      "Batch with ID 'non-existent-batch' not found."
    );
  });

  it("throws WaitlistError if user is already waitlisted for the same batch", async () => {
    const forUpdateMock = vi.fn().mockResolvedValue([{ id: batchId }]);
    const whereBatchMock = vi.fn().mockReturnValue({ for: forUpdateMock });
    const fromBatchMock = vi.fn().mockReturnValue({ where: whereBatchMock });

    vi.mocked(dbTx.select).mockReturnValue({ from: fromBatchMock } as unknown as ReturnType<typeof dbTx.select>);

    vi.mocked(dbTx.query.waitlist.findFirst).mockResolvedValue({
      id: "wl-1",
      batchId,
      userId: userId1,
      queuePosition: 1,
      joinedAt: new Date(),
    });

    await expect(addToWaitlist(userId1, batchId)).rejects.toThrow(
      WaitlistError
    );
    await expect(addToWaitlist(userId1, batchId)).rejects.toThrow(
      "User is already on the waitlist for this batch."
    );
  });
});

describe("Waitlist Service - removeFromWaitlist & Ownership / Authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.transaction).mockImplementation((cb: unknown) =>
      (cb as (tx: unknown) => unknown)(dbTx) as never
    );
  });

  const existingWl = {
    id: "wl-2",
    batchId: "batch-1",
    userId: "user-owner-uuid",
    queuePosition: 2,
    joinedAt: new Date(),
  };

  it("allows owner of waitlist entry to remove their own entry and compacts queue", async () => {
    vi.mocked(dbTx.query.waitlist.findFirst).mockResolvedValue(existingWl);

    const forUpdateMock = vi.fn().mockResolvedValue([{ id: "batch-1" }]);
    const whereBatchMock = vi.fn().mockReturnValue({ for: forUpdateMock });
    const fromBatchMock = vi.fn().mockReturnValue({ where: whereBatchMock });
    vi.mocked(dbTx.select).mockReturnValue({ from: fromBatchMock } as unknown as ReturnType<typeof dbTx.select>);

    const whereDeleteMock = vi.fn().mockResolvedValue([]);
    vi.mocked(dbTx.delete).mockReturnValue({ where: whereDeleteMock } as unknown as ReturnType<typeof dbTx.delete>);

    const whereUpdateMock = vi.fn().mockResolvedValue([]);
    const setUpdateMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
    vi.mocked(dbTx.update).mockReturnValue({ set: setUpdateMock } as unknown as ReturnType<typeof dbTx.update>);

    const removed = await removeFromWaitlist("wl-2", "user-owner-uuid", "member");

    expect(removed).toEqual(existingWl);
    expect(dbTx.delete).toHaveBeenCalled();
    expect(dbTx.update).toHaveBeenCalledTimes(2); // Pass 1 negation + Pass 2 compaction
  });

  it("allows batch_admin to remove any user's waitlist entry", async () => {
    vi.mocked(dbTx.query.waitlist.findFirst).mockResolvedValue(existingWl);

    const forUpdateMock = vi.fn().mockResolvedValue([{ id: "batch-1" }]);
    const whereBatchMock = vi.fn().mockReturnValue({ for: forUpdateMock });
    const fromBatchMock = vi.fn().mockReturnValue({ where: whereBatchMock });
    vi.mocked(dbTx.select).mockReturnValue({ from: fromBatchMock } as unknown as ReturnType<typeof dbTx.select>);

    const whereDeleteMock = vi.fn().mockResolvedValue([]);
    vi.mocked(dbTx.delete).mockReturnValue({ where: whereDeleteMock } as unknown as ReturnType<typeof dbTx.delete>);

    const whereUpdateMock = vi.fn().mockResolvedValue([]);
    const setUpdateMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
    vi.mocked(dbTx.update).mockReturnValue({ set: setUpdateMock } as unknown as ReturnType<typeof dbTx.update>);

    const removed = await removeFromWaitlist("wl-2", "admin-user-uuid", "batch_admin");

    expect(removed).toEqual(existingWl);
    expect(dbTx.delete).toHaveBeenCalled();
    expect(dbTx.update).toHaveBeenCalledTimes(2);
  });

  it("REJECTS unauthorized user who is not owner and not admin", async () => {
    vi.mocked(dbTx.query.waitlist.findFirst).mockResolvedValue(existingWl);

    await expect(
      removeFromWaitlist("wl-2", "other-malicious-user-uuid", "member")
    ).rejects.toThrow("You are not authorized to remove this waitlist entry.");
  });

  it("throws WaitlistError if entry to remove does not exist", async () => {
    vi.mocked(dbTx.query.waitlist.findFirst).mockResolvedValue(undefined);

    await expect(
      removeFromWaitlist("non-existent-wl", "any-user-uuid", "member")
    ).rejects.toThrow("Waitlist entry with ID 'non-existent-wl' not found.");
  });
});

describe("Waitlist Service - getWaitlistHead & getWaitlistQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("correctly determines #1 in line via getWaitlistHead", async () => {
    const headEntry = {
      id: "wl-1",
      batchId: "batch-1",
      userId: "user-1",
      queuePosition: 1,
      joinedAt: new Date(),
    };

    const limitMock = vi.fn().mockResolvedValue([headEntry]);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof db.select>);

    const result = await getWaitlistHead("batch-1");
    expect(result).toEqual(headEntry);
  });

  it("returns null if waitlist is empty for batch", async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof db.select>);

    const result = await getWaitlistHead("batch-1");
    expect(result).toBeNull();
  });

  it("retrieves full ordered queue via getWaitlistQueue", async () => {
    const queueEntries = [
      { id: "wl-1", batchId: "batch-1", userId: "u-1", queuePosition: 1, joinedAt: new Date() },
      { id: "wl-2", batchId: "batch-1", userId: "u-2", queuePosition: 2, joinedAt: new Date() },
    ];

    const orderByMock = vi.fn().mockResolvedValue(queueEntries);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof db.select>);

    const result = await getWaitlistQueue("batch-1");
    expect(result).toEqual(queueEntries);
    expect(result.length).toBe(2);
  });
});
