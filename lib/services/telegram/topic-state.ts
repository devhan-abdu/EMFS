import { and, asc, eq } from 'drizzle-orm';
import {
  paceGroups,
  telegramChatTopics,
  telegramObservedTopics,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import {
  evaluatePaceTopics,
  type PaceTopicEvaluation,
} from './topic-evaluation';

/** Documented cap: a batch has a handful of pace groups. */
export const MAX_PACE_GROUPS_LISTED = 200;
/** A batch group has a handful of topics; this bounds the read. */
export const MAX_TOPICS_READ = 500;

/**
 * Compares the batch's pace groups with the topics mapped and seen in Telegram.
 * Read-only; both the admin card and the match/create/rename services use it.
 */
export async function loadPaceTopicState(
  executor: DbOrTx,
  chat: { id: string; batchId: string },
): Promise<{
  evaluations: PaceTopicEvaluation[];
  announcementThreadId: number | null;
}> {
  const [groups, topics, observed] = await Promise.all([
    executor.query.paceGroups.findMany({
      where: and(
        eq(paceGroups.batchId, chat.batchId),
        eq(paceGroups.archived, false),
      ),
      columns: { id: true, name: true, size: true },
      orderBy: asc(paceGroups.name),
      limit: MAX_PACE_GROUPS_LISTED,
    }),
    executor.query.telegramChatTopics.findMany({
      where: eq(telegramChatTopics.telegramChatId, chat.id),
      limit: MAX_TOPICS_READ,
    }),
    executor.query.telegramObservedTopics.findMany({
      where: eq(telegramObservedTopics.telegramChatId, chat.id),
      limit: MAX_TOPICS_READ,
    }),
  ]);

  const evaluations = evaluatePaceTopics({
    groups,
    mappings: topics.flatMap((t) =>
      t.paceGroupId
        ? [{ paceGroupId: t.paceGroupId, messageThreadId: t.messageThreadId }]
        : [],
    ),
    observed: observed.map((o) => ({
      messageThreadId: o.messageThreadId,
      name: o.name,
    })),
  });

  return {
    evaluations,
    announcementThreadId:
      topics.find((t) => t.kind === 'announcement')?.messageThreadId ?? null,
  };
}
