import { and, asc, eq, gt, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/db';
import {
  applications,
  batchBreaks,
  batchMemberships,
  batchDailyTasks,
  batches,
  books,
  curriculumStepEditions,
  curriculumSteps,
  dailyProgress,
  handoffRecords,
  paceGroupMemberships,
  paceGroups,
  waitlist,
} from '@/db/schema';
import { buildTelegramStartLink } from '@/lib/services/bot';
import { formatDateKey } from '@/lib/services/daily-progress';

export type MemberScheduleState =
  | {
      status: 'before_batch_start';
      startDate: string | null;
    }
  | {
      status: 'published';
      dayNumber: number;
      task: typeof batchDailyTasks.$inferSelect & {
        startPage: number;
        endPage: number;
        content: string;
      };
      book?: typeof books.$inferSelect | null;
      isCompleted: boolean;
      completedAt: Date | null;
    }
  | {
      status: 'no_published_task';
    }
  | {
      status: 'rest_day';
    }
  | {
      status: 'break_day';
      title: string;
      endDate: string;
    }
  | {
      status: 'exhausted_curriculum';
    };

export type MemberHomeState =
  | { kind: 'no_batch' }
  | { kind: 'waitlisted'; batchName: string; queuePosition: number }
  | { kind: 'applied'; batchName: string }
  | { kind: 'rejected'; batchName: string }
  | {
      kind: 'approved_pending_handoff';
      batchName: string;
      telegramStartLink: string | null;
    }
  | {
      kind: 'active_awaiting_placement';
      batchId: string;
      batchName: string;
      message: string;
    }
  | {
      kind: 'active_placed';
      batchId: string;
      batchName: string;
      paceGroupId: string;
      paceGroupName: string;
      paceGroupSize: number;
      schedule: MemberScheduleState;
    };

export async function getMemberHomeState(
  profileId: string,
  referenceDate?: string | Date,
): Promise<MemberHomeState> {
  const membership = await db.query.batchMemberships.findFirst({
    where: eq(batchMemberships.profileId, profileId),
    orderBy: (fields, { desc }) => desc(fields.createdAt),
  });

  if (!membership) {
    return { kind: 'no_batch' };
  }

  const batch = await db.query.batches.findFirst({
    where: eq(batches.id, membership.batchId),
  });
  const batchName = batch?.name ?? 'your batch';

  if (membership.status === 'waitlisted') {
    const entry = await db.query.waitlist.findFirst({
      where: and(
        eq(waitlist.userId, profileId),
        eq(waitlist.batchId, membership.batchId),
      ),
    });
    return {
      kind: 'waitlisted',
      batchName,
      queuePosition: entry?.queuePosition ?? 0,
    };
  }

  if (membership.status === 'applied') {
    return { kind: 'applied', batchName };
  }

  if (membership.status === 'rejected') {
    return { kind: 'rejected', batchName };
  }

  if (membership.status === 'approved') {
    const application = await db.query.applications.findFirst({
      where: and(
        eq(applications.profileId, profileId),
        eq(applications.batchId, membership.batchId),
      ),
      orderBy: (fields, { desc }) => desc(fields.createdAt),
    });

    const handoff = application
      ? await db.query.handoffRecords.findFirst({
          where: eq(handoffRecords.applicationId, application.id),
        })
      : null;

    return {
      kind: 'approved_pending_handoff',
      batchName,
      telegramStartLink:
        handoff && !handoff.usedAt
          ? buildTelegramStartLink(handoff.code)
          : null,
    };
  }

  // Active batch membership: derive active pace group in this batch
  const activeGroupMemberships = await db.query.paceGroupMemberships.findMany({
    where: and(
      eq(paceGroupMemberships.profileId, profileId),
      eq(paceGroupMemberships.status, 'active'),
    ),
  });

  let activePaceGroup: typeof paceGroups.$inferSelect | null | undefined;

  for (const groupMembership of activeGroupMemberships) {
    const pg = await db.query.paceGroups.findFirst({
      where: and(
        eq(paceGroups.id, groupMembership.paceGroupId),
        eq(paceGroups.batchId, membership.batchId),
        eq(paceGroups.archived, false),
      ),
    });

    if (pg) {
      activePaceGroup = pg;
      break;
    }
  }

  if (!activePaceGroup) {
    return {
      kind: 'active_awaiting_placement',
      batchId: membership.batchId,
      batchName,
      message:
        'You are accepted into this batch. Your pace group will be assigned soon.',
    };
  }

  const paceGroup = activePaceGroup;
  const todayKey = referenceDate
    ? formatDateKey(referenceDate)
    : formatDateKey(new Date());

  let schedule: MemberScheduleState;

  if (!batch?.startDate) {
    schedule = {
      status: 'before_batch_start',
      startDate: null,
    };
  } else {
    const batchStartDate = formatDateKey(batch.startDate);

    if (batchStartDate > todayKey) {
      schedule = {
        status: 'before_batch_start',
        startDate: batchStartDate,
      };
    } else {
      const breaksToday = await db.query.batchBreaks.findMany({
        where: and(
          eq(batchBreaks.batchId, membership.batchId),
          or(
            isNull(batchBreaks.paceGroupId),
            eq(batchBreaks.paceGroupId, paceGroup.id),
          ),
          lte(batchBreaks.startDate, todayKey),
          gte(batchBreaks.endDate, todayKey),
        ),
        orderBy: [asc(batchBreaks.startDate)],
      });

      if (breaksToday[0]) {
        schedule = {
          status: 'break_day',
          title: breaksToday[0].title,
          endDate: breaksToday[0].endDate,
        };
      } else {
        const taskForToday = await db.query.batchDailyTasks.findFirst({
          where: and(
            eq(batchDailyTasks.paceGroupId, paceGroup.id),
            eq(batchDailyTasks.scheduledDate, todayKey),
          ),
        });

        if (!taskForToday) {
          const [futureTask, anyGroupTask] = await Promise.all([
            db.query.batchDailyTasks.findFirst({
              where: and(
                eq(batchDailyTasks.paceGroupId, paceGroup.id),
                gt(batchDailyTasks.scheduledDate, todayKey),
              ),
            }),
            db.query.batchDailyTasks.findFirst({
              where: eq(batchDailyTasks.paceGroupId, paceGroup.id),
            }),
          ]);

          if (anyGroupTask && !futureTask) {
            schedule = { status: 'exhausted_curriculum' };
          } else if (futureTask) {
            schedule = { status: 'rest_day' };
          } else {
            schedule = { status: 'no_published_task' };
          }
        } else if (taskForToday.publicationStatus !== 'published') {
          schedule = { status: 'no_published_task' };
        } else {
          const dayNumber = taskForToday.batchDayNumber;
          const curriculumStep = await db.query.curriculumSteps.findFirst({
            where: eq(curriculumSteps.id, taskForToday.curriculumStepId),
          });
          const book = curriculumStep
            ? await db.query.books.findFirst({
                where: and(
                  eq(books.catalogSlotId, paceGroup.activeCatalogSlotId),
                  eq(books.language, 'en'),
                ),
              })
            : null;

          if (
            curriculumStep &&
            book &&
            curriculumStep.catalogSlotId === book.catalogSlotId &&
            curriculumStep.paceSize === paceGroup.size
          ) {
            const stepEdition = await db.query.curriculumStepEditions.findFirst(
              {
                where: and(
                  eq(
                    curriculumStepEditions.curriculumStepId,
                    curriculumStep.id,
                  ),
                  eq(curriculumStepEditions.bookId, book.id),
                ),
              },
            );
            const progress = await db.query.dailyProgress.findFirst({
              where: and(
                eq(dailyProgress.profileId, profileId),
                eq(dailyProgress.taskId, taskForToday.id),
              ),
            });

            schedule = {
              status: 'published',
              dayNumber,
              task: {
                ...taskForToday,
                startPage: stepEdition?.startPage ?? 1,
                endPage: stepEdition?.endPage ?? 1,
                content:
                  taskForToday.localCaptionOverride ??
                  stepEdition?.caption ??
                  '',
              },
              book,
              isCompleted: progress?.status === 'done',
              completedAt: progress?.completedAt ?? null,
            };
          } else {
            schedule = { status: 'no_published_task' };
          }
        }
      }
    }
  }

  return {
    kind: 'active_placed',
    batchId: membership.batchId,
    batchName,
    paceGroupId: paceGroup.id,
    paceGroupName: paceGroup.name,
    paceGroupSize: paceGroup.size,
    schedule,
  };
}
