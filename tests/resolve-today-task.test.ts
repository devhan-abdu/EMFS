import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTodayTask } from '../lib/services/curriculum/resolve-today-task';

const mocks = vi.hoisted(() => ({
  findPaceGroup: vi.fn(),
  findBook: vi.fn(),
  findLastTask: vi.fn(),
  findCurriculumStep: vi.fn(),
  findStepEdition: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      paceGroups: { findFirst: mocks.findPaceGroup },
      books: { findFirst: mocks.findBook },
      batchDailyTasks: { findFirst: mocks.findLastTask },
      curriculumSteps: { findFirst: mocks.findCurriculumStep },
      curriculumStepEditions: { findFirst: mocks.findStepEdition },
    },
  },
}));

describe('resolveTodayTask', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findPaceGroup.mockResolvedValue({
      id: 'group-1',
      activeCatalogSlotId: 'slot-2',
      size: 5,
    });
    mocks.findBook.mockResolvedValue({
      id: 'edition-2-en',
      catalogSlotId: 'slot-2',
      language: 'en',
      pageCount: 100,
    });
    mocks.findLastTask.mockResolvedValue(null);
    mocks.findStepEdition.mockResolvedValue({
      id: 'edition-range-1',
      curriculumStepId: 'step-slot-2-pace-5-day-1',
      catalogSlotId: 'slot-2',
      bookId: 'edition-2-en',
      startPage: 11,
      endPage: 15,
      caption: 'Read pages 11–15',
      chapterLabel: null,
    });
  });

  it('uses the active catalog slot and the English edition range for the next step', async () => {
    const step = {
      id: 'step-slot-2-pace-5-day-1',
      catalogSlotId: 'slot-2',
      paceSize: 5,
      stepNumber: 1,
      version: 1,
    };
    mocks.findCurriculumStep.mockResolvedValueOnce(step);

    const result = await resolveTodayTask('group-1');

    expect(result).toMatchObject({
      isPioneer: false,
      stepNumber: 1,
      book: { id: 'edition-2-en' },
      step,
      range: { startPage: 11, endPage: 15 },
    });
    expect(mocks.findCurriculumStep).toHaveBeenCalledTimes(1);
    expect(mocks.findStepEdition).toHaveBeenCalledTimes(1);
  });

  it('suggests the first five pages when no shared step exists', async () => {
    mocks.findCurriculumStep.mockResolvedValueOnce(null);
    mocks.findStepEdition.mockResolvedValueOnce(null);

    const result = await resolveTodayTask('group-1');

    expect(result).toMatchObject({
      isPioneer: true,
      stepNumber: 1,
      suggestedRange: { startPage: 1, endPage: 5 },
    });
  });
});
