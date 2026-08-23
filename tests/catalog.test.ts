import { describe, it, expect } from "vitest";
import { createBookSchema, createTaskSchema } from "../lib/validations/catalog";

const validBook = {
  title: "Atomic Habits",
  language: "en",
};

const validTask = {
  bookId: "550e8400-e29b-41d4-a716-446655440000",
  dayNumber: 1,
  content: "Read pages 1–20",
};

describe("createBookSchema", () => {
  it("parses valid minimal input", () => {
    const result = createBookSchema.safeParse(validBook);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Atomic Habits");
      expect(result.data.language).toBe("en");
      expect(result.data.author).toBeUndefined();
      expect(result.data.coverUrl).toBeUndefined();
      expect(result.data.pairedBookId).toBeUndefined();
    }
  });

  it("parses valid full input with all optional fields", () => {
    const result = createBookSchema.safeParse({
      ...validBook,
      author: "James Clear",
      coverUrl: "https://example.com/cover.jpg",
      pairedBookId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("parses Amharic language code", () => {
    const result = createBookSchema.safeParse({
      ...validBook,
      language: "am",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const { title: _title, ...rest } = validBook;
    const result = createBookSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing language", () => {
    const { language: _language, ...rest } = validBook;
    const result = createBookSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createBookSchema.safeParse({ ...validBook, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid language code (uppercase)", () => {
    const result = createBookSchema.safeParse({ ...validBook, language: "EN" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid language code (too long)", () => {
    const result = createBookSchema.safeParse({ ...validBook, language: "english" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid pairedBookId (not a UUID)", () => {
    const result = createBookSchema.safeParse({ ...validBook, pairedBookId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("does not allow sequenceOrder to be smuggled through", () => {
    const result = createBookSchema.safeParse({
      ...validBook,
      sequenceOrder: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("sequenceOrder" in result.data).toBe(false);
    }
  });
});

describe("createTaskSchema", () => {
  it("parses valid input", () => {
    const result = createTaskSchema.safeParse(validTask);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookId).toBe(validTask.bookId);
      expect(result.data.dayNumber).toBe(1);
      expect(result.data.content).toBe("Read pages 1–20");
    }
  });

  it("rejects missing bookId", () => {
    const { bookId: _bookId, ...rest } = validTask;
    const result = createTaskSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing dayNumber", () => {
    const { dayNumber: _dayNumber, ...rest } = validTask;
    const result = createTaskSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing content", () => {
    const { content: _content, ...rest } = validTask;
    const result = createTaskSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = createTaskSchema.safeParse({ ...validTask, content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid bookId (not a UUID)", () => {
    const result = createTaskSchema.safeParse({ ...validTask, bookId: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects zero dayNumber", () => {
    const result = createTaskSchema.safeParse({ ...validTask, dayNumber: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative dayNumber", () => {
    const result = createTaskSchema.safeParse({ ...validTask, dayNumber: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer dayNumber", () => {
    const result = createTaskSchema.safeParse({ ...validTask, dayNumber: 1.5 });
    expect(result.success).toBe(false);
  });
});
