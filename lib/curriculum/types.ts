/**
 * Canonical calendar date string in YYYY-MM-DD format without time or timezone components.
 */
export type DateKey = string;

/**
 * 1-indexed inclusive page interval within a book edition [startPage, endPage].
 */
export type PageRange = {
  startPage: number;
  endPage: number;
};

/**
 * Pacing calendar exception offset applying from a specific curriculum day number.
 */
export type ScheduleOffset = {
  effectiveFromDayNumber: number;
  offsetDays: number;
  reason?: string | null;
};

/**
 * Domain resolution state for a given calendar date in a cohort batch schedule.
 */
export type StepResolution =
  | {
      state: 'before_start';
      startDate: DateKey;
      targetDate: DateKey;
      nextStep: 1;
      nextDate: DateKey;
    }
  | {
      state: 'scheduled';
      step: number;
      date: DateKey;
    }
  | {
      state: 'rest_day';
      date: DateKey;
      previousStep: number;
      nextStep: number;
      nextDate: DateKey;
    };

/**
 * Reference to a pre-authored pace post / inspiration content template.
 */
export type PostRef = {
  id: string;
  pacePostId?: string | null;
  caption: string;
  captionAm?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
};

/**
 * Global catalog program book edition summary used across curriculum and schedule layers.
 */
export type ProgramBook = {
  id: string;
  title: string;
  language: string;
  sequenceOrder: number;
  author?: string | null;
  coverUrl?: string | null;
  summary?: string | null;
  pageCount?: number | null;
  pairedBookId?: string | null;
};
