import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import {
  applications,
  batchMemberships,
  batches,
  books,
  dailyProgress,
  dailyTasks,
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
      task: typeof dailyTasks.$inferSelect;
      book?: typeof books.$inferSelect | null;
      isCompleted: boolean;
      completedAt: Date | null;
    }
  | {
      status: 'no_published_task';
      dayNumber: number;
    }
  | {
      status: 'rest_day';
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
      const [y1, m1, d1] = todayKey.split('-').map(Number);
      const [y0, m0, d0] = batchStartDate.split('-').map(Number);
      const calendarDays = Math.max(
        0,
        Math.round(
          (Date.UTC(y1, m1 - 1, d1) - Date.UTC(y0, m0 - 1, d0)) /
            (1000 * 60 * 60 * 24),
        ),
      );

      const cadence = Math.max(1, Math.min(7, batch.readingDaysPerWeek || 6));
      const dayInCycle = calendarDays % 7;

      if (dayInCycle >= cadence) {
        schedule = { status: 'rest_day' };
      } else {
        const dayNumber =
          Math.floor(calendarDays / 7) * cadence + dayInCycle + 1;

        const publishedTask = await db.query.dailyTasks.findFirst({
          where: and(
            eq(dailyTasks.paceGroupId, paceGroup.id),
            eq(dailyTasks.dayNumber, dayNumber),
            eq(dailyTasks.publicationStatus, 'published'),
          ),
          with: {
            book: true,
          },
        });

        if (publishedTask) {
          const progress = await db.query.dailyProgress.findFirst({
            where: and(
              eq(dailyProgress.profileId, profileId),
              eq(dailyProgress.taskId, publishedTask.id),
            ),
          });

          schedule = {
            status: 'published',
            dayNumber,
            task: publishedTask,
            book: publishedTask.book,
            isCompleted: progress?.status === 'done',
            completedAt: progress?.completedAt ?? null,
          };
        } else {
          const futureTasks = await db.query.dailyTasks.findFirst({
            where: and(
              eq(dailyTasks.paceGroupId, paceGroup.id),
              gte(dailyTasks.dayNumber, dayNumber),
            ),
          });

          const anyGroupTasks = await db.query.dailyTasks.findFirst({
            where: eq(dailyTasks.paceGroupId, paceGroup.id),
          });

          if (anyGroupTasks && !futureTasks) {
            schedule = { status: 'exhausted_curriculum' };
          } else {
            schedule = { status: 'no_published_task', dayNumber };
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
