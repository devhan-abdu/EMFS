import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBookWithCover } from "../lib/services/create-book";

type InsertPayload = {
  title: string;
  language: string;
  author?: string | null;
  coverUrl?: string | null;
  pairedBookId?: string;
  sequenceOrder: number;
};

const mocks = vi.hoisted(() => {
  const insertValuesMock = vi.fn((data: InsertPayload) => ({
    returning: vi.fn(async () => [{
      id: "book-1",
      title: "The Example Book",
      language: "en",
      author: "Jane Author",
      coverUrl: data.coverUrl,
    }]),
  }));

  const selectMock = vi.fn();
  const insertMock = vi.fn();

  return { insertValuesMock, selectMock, insertMock };
});

const { insertValuesMock, selectMock, insertMock } = mocks;

vi.mock("@/db", () => ({
  db: {
    select: mocks.selectMock,
    insert: mocks.insertMock,
  },
}));

describe("createBookWithCover", () => {
  beforeEach(() => {
    selectMock.mockReset();
    insertMock.mockReset();

    selectMock.mockImplementation(() => ({
      from: vi.fn(() => {
        const rows = [{ maxSequenceOrder: 3 }];
        const promise = Promise.resolve(rows);
        return Object.assign(promise, {
          where: vi.fn(() => {
            const wherePromise = Promise.resolve(rows);
            return Object.assign(wherePromise, {
              limit: vi.fn(async () => rows),
            });
          }),
        });
      }),
    }));

    insertMock.mockReturnValue({
      values: insertValuesMock,
    });
  });


  it("uploads the cover and stores only the storage key in the book row", async () => {
    const validPng = await sharp({
      create: {
        width: 1200,
        height: 1200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await createBookWithCover(
      {
        title: "The Example Book",
        language: "en",
        author: "Jane Author",
        cover: {
          body: new Uint8Array(validPng),
          declaredType: "image/png",
        },
      },
      {
        upload: vi.fn(async ({ key, contentType }) => ({
          key,
          publicUrl: `https://cdn.example.com/${key}`,
          contentType,
        })),
        delete: vi.fn(async () => undefined),
        getPublicUrl: (key) => `https://cdn.example.com/${key}`,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected book creation to succeed");
    }

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceOrder: 4 }),
    );
    expect(result.data.coverUrl).toMatch(/^covers\/[0-9a-f-]+\.webp$/);
    expect(result.data.coverUrl).not.toContain("fake png bytes");
    expect(result.data.coverUrl).not.toContain("Jane Author");
    expect(result.data.coverUrl).not.toContain("The Example Book");
  });

  it("deletes the uploaded object when book creation fails after upload", async () => {
    const deleteMock = vi.fn(async () => undefined);
    const storageService = {
      upload: vi.fn(async ({ key }) => ({
        key,
        publicUrl: `https://cdn.example.com/${key}`,
      })),
      delete: deleteMock,
      getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
    };

    selectMock.mockImplementation(() => ({
      from: vi.fn(() => {
        const rows: Array<Record<string, unknown>> = [];
        return Object.assign(Promise.resolve(rows), {
          where: vi.fn(() => ({
            limit: vi.fn(async () => rows),
          })),
        });
      }),
    }));

    insertMock.mockReturnValue({
      values: vi.fn(() => {
        throw new Error("database insert failed");
      }),
    });

    const validPng = await sharp({
      create: {
        width: 1200,
        height: 1200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(
      createBookWithCover(
        {
          title: "Bad Book",
          language: "en",
          cover: {
            body: new Uint8Array(validPng),
            declaredType: "image/png",
          },
        },
        storageService,
      ),
    ).rejects.toThrow("database insert failed");

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});
