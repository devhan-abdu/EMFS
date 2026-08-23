import { describe, it, expect } from "vitest";
import {
  setBatchScheduleSchema,
  createPacingOffsetSchema,
} from "../lib/validations/batch-schedule";

const validSchedule = {
  batchId: "550e8400-e29b-41d4-a716-446655440000",
  startDate: "2026-01-15",
  readingDaysPerWeek: 6,
};

const validOffset = {
  batchId: "550e8400-e29b-41d4-a716-446655440000",
  effectiveFromDayNumber: 1,
  offsetDays: -2,
  reason: "Holiday fell on reading day",
  editorId: "660e8400-e29b-41d4-a716-446655440000",
};

describe("setBatchScheduleSchema", () => {
  it("parses valid input", () => {
    const result = setBatchScheduleSchema.safeParse(validSchedule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.batchId).toBe(validSchedule.batchId);
      expect(result.data.readingDaysPerWeek).toBe(6);
      expect(result.data.startDate).toBeInstanceOf(Date);
    }
  });

  it("accepts all valid reading days per week (1-7)", () => {
    for (const days of [1, 2, 3, 4, 5, 6, 7]) {
      const result = setBatchScheduleSchema.safeParse({
        ...validSchedule,
        readingDaysPerWeek: days,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects readingDaysPerWeek of 0", () => {
    const result = setBatchScheduleSchema.safeParse({
      ...validSchedule,
      readingDaysPerWeek: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative readingDaysPerWeek", () => {
    const result = setBatchScheduleSchema.safeParse({
      ...validSchedule,
      readingDaysPerWeek: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer readingDaysPerWeek", () => {
    const result = setBatchScheduleSchema.safeParse({
      ...validSchedule,
      readingDaysPerWeek: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects readingDaysPerWeek greater than 7", () => {
    const result = setBatchScheduleSchema.safeParse({
      ...validSchedule,
      readingDaysPerWeek: 8,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date string for startDate", () => {
    const result = setBatchScheduleSchema.safeParse({
      ...validSchedule,
      startDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing batchId", () => {
    const { batchId: _batchId, ...rest } = validSchedule;
    const result = setBatchScheduleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing startDate", () => {
    const { startDate: _startDate, ...rest } = validSchedule;
    const result = setBatchScheduleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing readingDaysPerWeek", () => {
    const { readingDaysPerWeek: _readingDaysPerWeek, ...rest } = validSchedule;
    const result = setBatchScheduleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid batchId (not a UUID)", () => {
    const result = setBatchScheduleSchema.safeParse({
      ...validSchedule,
      batchId: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPacingOffsetSchema", () => {
  it("parses valid input with negative offset", () => {
    const result = createPacingOffsetSchema.safeParse(validOffset);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offsetDays).toBe(-2);
      expect(result.data.reason).toBe("Holiday fell on reading day");
    }
  });

  it("parses valid input with positive offset", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      offsetDays: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero offsetDays", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      offsetDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer offsetDays", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      offsetDays: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing reason", () => {
    const { reason: _reason, ...rest } = validOffset;
    const result = createPacingOffsetSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty reason", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing editorId", () => {
    const { editorId: _editorId, ...rest } = validOffset;
    const result = createPacingOffsetSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid editorId (not a UUID)", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      editorId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero effectiveFromDayNumber", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      effectiveFromDayNumber: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative effectiveFromDayNumber", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      effectiveFromDayNumber: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer effectiveFromDayNumber", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      effectiveFromDayNumber: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing batchId", () => {
    const { batchId: _batchId, ...rest } = validOffset;
    const result = createPacingOffsetSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid batchId (not a UUID)", () => {
    const result = createPacingOffsetSchema.safeParse({
      ...validOffset,
      batchId: "abc",
    });
    expect(result.success).toBe(false);
  });
});
