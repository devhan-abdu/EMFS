import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBookWithCover } from '../lib/services/catalog/create-book';
import * as authorizeModule from '../lib/auth/authorize';

const mockUploadToCloudinary = vi.hoisted(() => vi.fn());
const mockDeleteFromCloudinary = vi.hoisted(() => vi.fn());

vi.mock('../lib/services/catalog/cloudinary', () => ({
  uploadToCloudinary: mockUploadToCloudinary,
  isCloudinaryUrl: (url: string) => url.includes('res.cloudinary.com'),
  deleteFromCloudinary: mockDeleteFromCloudinary,
}));

type InsertPayload = {
  title?: string;
  language?: string;
  author?: string | null;
  coverUrl?: string | null;
  catalogSlotId?: string;
  sequenceOrder?: number;
};

const mocks = vi.hoisted(() => {
  const insertValuesMock = vi.fn();

  const selectMock = vi.fn();
  const insertMock = vi.fn();
  const transactionMock = vi.fn();

  return { insertValuesMock, selectMock, insertMock, transactionMock };
});

const { insertValuesMock, selectMock, insertMock, transactionMock } = mocks;

vi.mock('@/db', () => ({
  db: {
    select: mocks.selectMock,
    insert: mocks.insertMock,
    transaction: mocks.transactionMock,
  },
}));

vi.mock('@/lib/auth/authorize', () => ({
  requireSuperAdmin: vi.fn().mockResolvedValue(undefined),
}));

describe('createBookWithCover', () => {
  beforeEach(() => {
    mockUploadToCloudinary.mockReset();
    mockDeleteFromCloudinary.mockReset();
    mockDeleteFromCloudinary.mockResolvedValue(undefined);
    mockUploadToCloudinary.mockResolvedValue({
      secureUrl:
        'https://res.cloudinary.com/demo/image/upload/v1/emfs-covers/test.webp',
      publicId: 'emfs-covers/test',
    });

    selectMock.mockReset();
    insertMock.mockReset();
    transactionMock.mockReset();
    insertValuesMock.mockReset();

    selectMock.mockImplementation(() => ({
      from: vi.fn(() => {
        return [{ maxOrder: 3 }];
      }),
    }));

    insertMock.mockReturnValue({
      values: insertValuesMock,
    });
    insertValuesMock.mockImplementation((data: InsertPayload) => ({
      returning: vi.fn(async () =>
        data.catalogSlotId
          ? [
              {
                id: 'book-1',
                title: data.title ?? 'The Example Book',
                language: data.language ?? 'en',
                author: data.author ?? null,
                coverUrl: data.coverUrl ?? null,
                ...data,
              },
            ]
          : [{ id: 'slot-4' }],
      ),
    }));
    transactionMock.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ select: selectMock, insert: insertMock }),
    );
  });

  it.each([
    ['UNAUTHENTICATED', 'You must be signed in.'],
    ['FORBIDDEN', "Role 'member' is not permitted."],
    ['FORBIDDEN', "Role 'pace_admin' is not permitted."],
    ['FORBIDDEN', "Role 'batch_admin' is not permitted."],
  ] as const)('rejects direct calls for %s callers', async (code, message) => {
    vi.mocked(authorizeModule.requireSuperAdmin).mockRejectedValueOnce(
      Object.assign(new Error(message), { code }),
    );

    await expect(
      createBookWithCover({
        title: 'Blocked Book',
        language: 'en',
        pageCount: 100,
      }),
    ).rejects.toMatchObject({ code, message });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('uploads the cover to Cloudinary and stores the secure URL in the book row', async () => {
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

    const result = await createBookWithCover({
      title: 'The Example Book',
      language: 'en',
      author: 'Jane Author',
      pageCount: 250,
      cover: {
        body: new Uint8Array(validPng),
        declaredType: 'image/png',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected book creation to succeed');
    }

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'The Example Book',
        language: 'en',
        catalogSlotId: 'slot-4',
      }),
    );
    expect(result.data.coverUrl).toBe(
      'https://res.cloudinary.com/demo/image/upload/v1/emfs-covers/test.webp',
    );
  });

  it('stores an external Google Books cover URL without uploading', async () => {
    const googleCover =
      'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1';

    const result = await createBookWithCover({
      title: 'Google Book',
      language: 'en',
      pageCount: 200,
      coverUrl: googleCover,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected book creation to succeed');
    }

    expect(result.data.coverUrl).toBe(googleCover);
    expect(mockUploadToCloudinary).not.toHaveBeenCalled();
  });

  it('deletes the uploaded Cloudinary asset when book creation fails after upload', async () => {
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

    insertValuesMock
      .mockImplementationOnce(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'slot-4' }]),
      }))
      .mockImplementationOnce(() => {
        throw new Error('database insert failed');
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
      createBookWithCover({
        title: 'Bad Book',
        language: 'en',
        pageCount: 100,
        cover: {
          body: new Uint8Array(validPng),
          declaredType: 'image/png',
        },
      }),
    ).rejects.toThrow('database insert failed');

    expect(mockDeleteFromCloudinary).toHaveBeenCalledTimes(1);
  });
});
