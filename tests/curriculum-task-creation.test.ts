import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  batchDailyTasks,
  curriculumStepEditions,
  curriculumSteps,
} from '@/db/schema';
import { createAndPublishPioneerTask } from '../lib/services/curriculum/publish-pioneer-task';
import { publishFollowerTask } from '../lib/services/curriculum/publish-follower-task';

const mocks = vi.hoisted(() => ({
  groupFindFirst: vi.fn(),
  bookFindFirst: vi.fn(),
  stepFindFirst: vi.fn(),
  dbInsert: vi.fn(),
  txInsert: vi.fn(),
  txTransaction: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      paceGroups: { findFirst: mocks.groupFindFirst },
      books: { findFirst: mocks.bookFindFirst },
      curriculumSteps: { findFirst: mocks.stepFindFirst },
    },
    insert: mocks.dbInsert,
    transaction: mocks.txTransaction,
  },
}));

describe('curriculum task creation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a pioneer task with the active catalog slot and English edition range', async () => {
    const group = {
      id: 'group-1',
      batchId: 'batch-1',
      activeCatalogSlotId: 'slot-2',
      size: 10,
    };
    const book = {
      id: 'book-en-2',
      catalogSlotId: 'slot-2',
      language: 'en',
      pageCount: 120,
    };
    const savedStep = {
      id: 'step-1',
      catalogSlotId: 'slot-2',
      paceSize: 10,
      stepNumber: 2,
      version: 1,
    };
    const savedEdition = {
      id: 'edition-1',
      curriculumStepId: 'step-1',
      catalogSlotId: 'slot-2',
      bookId: 'book-en-2',
      startPage: 11,
      endPage: 20,
      caption: 'Read pages 11–20',
      chapterLabel: null,
    };
    const publishedPost = {
      id: 'task-1',
      paceGroupId: 'group-1',
      curriculumStepId: 'step-1',
      batchDayNumber: 3,
      scheduledDate: '2026-10-03',
      publicationStatus: 'published',
    };

    mocks.groupFindFirst.mockResolvedValue(group);
    mocks.bookFindFirst.mockResolvedValue(book);
    mocks.txTransaction.mockImplementation(async (callback) => {
      const tx = {
        query: {
          paceGroups: { findFirst: mocks.groupFindFirst },
          books: { findFirst: mocks.bookFindFirst },
        },
        insert: vi.fn((table) => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () =>
              table === curriculumSteps
                ? [savedStep]
                : table === curriculumStepEditions
                  ? [savedEdition]
                  : [publishedPost],
            ),
          })),
        })),
      };

      return callback(tx);
    });

    const result = await createAndPublishPioneerTask({
      paceGroupId: 'group-1',
      stepNumber: 2,
      caption: 'Read pages 11–20',
      startPage: 11,
      endPage: 20,
      batchDayNumber: 3,
      scheduledDate: '2026-10-03',
    });

    expect(result.savedStep).toMatchObject({
      catalogSlotId: 'slot-2',
      paceSize: 10,
      stepNumber: 2,
    });
    expect(result.savedEdition).toMatchObject({
      bookId: 'book-en-2',
      startPage: 11,
      endPage: 20,
      caption: 'Read pages 11–20',
    });
    expect(result.publishedPost).toMatchObject({
      paceGroupId: 'group-1',
      curriculumStepId: 'step-1',
      publicationStatus: 'published',
    });
  });

  it('publishes a follower task only when the step matches the pace group slot and size', async () => {
    const group = {
      id: 'group-1',
      batchId: 'batch-1',
      activeCatalogSlotId: 'slot-2',
      size: 10,
    };
    const step = {
      id: 'step-2',
      catalogSlotId: 'slot-2',
      paceSize: 10,
      stepNumber: 2,
      version: 1,
    };
    const book = {
      id: 'book-en-2',
      catalogSlotId: 'slot-2',
      language: 'en',
      pageCount: 120,
    };
    const publishedTask = {
      id: 'task-2',
      paceGroupId: 'group-1',
      curriculumStepId: 'step-2',
      batchDayNumber: 4,
      scheduledDate: '2026-10-04',
      localCaptionOverride: null,
      publicationStatus: 'published',
    };

    mocks.groupFindFirst.mockResolvedValue(group);
    mocks.stepFindFirst.mockResolvedValue(step);
    mocks.bookFindFirst.mockResolvedValue(book);
    mocks.dbInsert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [publishedTask]),
      })),
    });

    const result = await publishFollowerTask({
      paceGroupId: 'group-1',
      curriculumStepId: 'step-2',
      batchDayNumber: 4,
      scheduledDate: '2026-10-04',
    });

    expect(result).toMatchObject({
      curriculumStepId: 'step-2',
      paceGroupId: 'group-1',
      publicationStatus: 'published',
    });
    expect(mocks.dbInsert).toHaveBeenCalledWith(batchDailyTasks);
  });

  it('rejects follower publication when the step does not belong to the active slot', async () => {
    const group = {
      id: 'group-1',
      batchId: 'batch-1',
      activeCatalogSlotId: 'slot-2',
      size: 10,
    };
    const step = {
      id: 'step-3',
      catalogSlotId: 'slot-3',
      paceSize: 10,
      stepNumber: 1,
      version: 1,
    };
    const book = {
      id: 'book-en-2',
      catalogSlotId: 'slot-2',
      language: 'en',
      pageCount: 120,
    };

    mocks.groupFindFirst.mockResolvedValue(group);
    mocks.stepFindFirst.mockResolvedValue(step);
    mocks.bookFindFirst.mockResolvedValue(book);

    await expect(
      publishFollowerTask({
        paceGroupId: 'group-1',
        curriculumStepId: 'step-3',
        batchDayNumber: 5,
        scheduledDate: '2026-10-05',
      }),
    ).rejects.toThrow('Curriculum step does not match the pace group.');
  });
});
