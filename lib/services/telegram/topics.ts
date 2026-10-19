import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import {
  batches,
  paceGroups,
  telegramChats,
  telegramChatTopics,
  telegramObservedTopics,
} from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import {
  batchIdSchema,
  groupChatIdSchema,
  threadIdSchema,
} from '@/lib/validations/telegram';
import {
  TelegramConnectionError,
  describeTelegramError,
  isUniqueViolation,
} from './errors';
import { toApiChatId, type TelegramApiPort } from './api-port';
import { upsertObservedTopic } from './observed-topics';
import { needsAttention, type PaceTopicEvaluation } from './topic-evaluation';
import {
  paceTopicName,
  parsePaceTopicName,
  topicMatchesGroup,
} from './topic-names';
import { MAX_PACE_GROUPS_LISTED, loadPaceTopicState } from './topic-state';

type TelegramChatRow = typeof telegramChats.$inferSelect;

async function requireChatByChatId(executor: DbOrTx, chatId: bigint) {
  groupChatIdSchema.parse(chatId);
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.chatId, chatId),
  });
  if (!chat) {
    throw new TelegramConnectionError(
      'NOT_CONNECTED',
      'This group is not linked to a batch yet. Use /link CODE first.',
    );
  }
  return chat;
}

async function requireChatByBatch(executor: DbOrTx, batchId: string) {
  const chat = await executor.query.telegramChats.findFirst({
    where: eq(telegramChats.batchId, batchId),
  });
  if (!chat) {
    throw new TelegramConnectionError(
      'NOT_CONNECTED',
      'This batch has no Telegram group.',
    );
  }
  return chat;
}

/** Serializes topic work per batch so double clicks cannot create duplicates. */
async function lockBatchTopics(tx: DbOrTx, batchId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`telegram-topics:${batchId}`}))`,
  );
}

function requireWritableChat(chat: TelegramChatRow) {
  if (chat.status !== 'active') {
    throw new TelegramConnectionError(
      'TELEGRAM_API_ERROR',
      'The bot is no longer in the group. Re-add it as admin, then use "Re-check".',
    );
  }
  if (!chat.isForum) {
    throw new TelegramConnectionError(
      'NOT_A_FORUM',
      'Topics are not enabled in the group. Turn them on, then use "Re-check".',
    );
  }
  if (!chat.canManageTopics) {
    throw new TelegramConnectionError(
      'TELEGRAM_API_ERROR',
      'The bot needs the "Manage topics" admin right. Grant it, then use "Re-check".',
    );
  }
}

/** Escapes LIKE wildcards so a pace group name is matched literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

async function insertPaceMapping(
  tx: DbOrTx,
  chat: TelegramChatRow,
  evaluation: Pick<
    PaceTopicEvaluation,
    'paceGroupId' | 'expectedName' | 'messageThreadId'
  >,
  threadId: number,
) {
  await tx.insert(telegramChatTopics).values({
    telegramChatId: chat.id,
    messageThreadId: threadId,
    kind: 'pace_group',
    paceGroupId: evaluation.paceGroupId,
    name: evaluation.expectedName,
  });
}

/**
 * `/topic pace [name]` was sent inside a topic. The pace group is found from the
 * given name, or from the topic's own name when none is given. The topic's real
 * name (read by the bot) must equal the group's canonical name: the system, not
 * Telegram, decides what each topic is called.
 */
export async function mapPaceTopic(
  executor: DbOrTx,
  input: {
    chatId: bigint;
    messageThreadId: number;
    /** Text after `/topic pace`; null/undefined to use the topic's own name. */
    paceGroupName?: string | null;
    /** Topic name read from the message that carried the command, if available. */
    topicName?: string | null;
  },
) {
  const threadId = threadIdSchema.parse(input.messageThreadId);
  const chat = await requireChatByChatId(executor, input.chatId);

  const observed = await executor.query.telegramObservedTopics.findFirst({
    where: and(
      eq(telegramObservedTopics.telegramChatId, chat.id),
      eq(telegramObservedTopics.messageThreadId, threadId),
    ),
  });
  const topicName = input.topicName?.trim() || observed?.name || null;

  const batchGroups = () =>
    executor.query.paceGroups.findMany({
      where: and(
        eq(paceGroups.batchId, chat.batchId),
        eq(paceGroups.archived, false),
      ),
      columns: { id: true, name: true, size: true },
      orderBy: asc(paceGroups.name),
      limit: MAX_PACE_GROUPS_LISTED,
    });
  const available = (groups: { name: string; size: number }[]) =>
    groups.map(paceTopicName).join(', ') || 'none';

  let group: { id: string; name: string; size: number } | undefined;
  const given = input.paceGroupName?.trim();

  if (given) {
    const parsed = parsePaceTopicName(given);
    const candidates = await executor.query.paceGroups.findMany({
      where: and(
        eq(paceGroups.batchId, chat.batchId),
        eq(paceGroups.archived, false),
        ilike(paceGroups.name, escapeLike(parsed?.name ?? given)),
        ...(parsed ? [eq(paceGroups.size, parsed.size)] : []),
      ),
      columns: { id: true, name: true, size: true },
      limit: 5,
    });
    if (candidates.length > 1) {
      throw new TelegramConnectionError(
        'PACE_GROUP_AMBIGUOUS',
        `Several pace groups are named "${given}": ${available(candidates)}. Use the full name, e.g. /topic pace ${paceTopicName(candidates[0])}.`,
      );
    }
    group = candidates[0];
    if (!group) {
      throw new TelegramConnectionError(
        'PACE_GROUP_NOT_FOUND',
        `No pace group "${given}" in this batch. Available: ${available(await batchGroups())}.`,
      );
    }
  } else {
    if (!topicName) {
      throw new TelegramConnectionError(
        'PACE_GROUP_NOT_FOUND',
        "I cannot read this topic's name. Send /topic pace <pace group name> instead.",
      );
    }
    const groups = await batchGroups();
    group = groups.find((g) => topicMatchesGroup(topicName, g));
    if (!group) {
      throw new TelegramConnectionError(
        'PACE_GROUP_NOT_FOUND',
        `This topic is named "${topicName}", which matches no pace group. Name it like one of: ${available(groups)}.`,
      );
    }
  }

  const expectedName = paceTopicName(group);
  if (topicName && !topicMatchesGroup(topicName, group)) {
    throw new TelegramConnectionError(
      'TOPIC_NAME_MISMATCH',
      `This topic is named "${topicName}" but ${group.name} must use "${expectedName}". Rename the topic, then send /topic pace again.`,
    );
  }

  const target = group;
  await executor.transaction(async (tx) => {
    const existing = await tx.query.telegramChatTopics.findFirst({
      where: and(
        eq(telegramChatTopics.telegramChatId, chat.id),
        eq(telegramChatTopics.messageThreadId, threadId),
      ),
    });
    if (existing && existing.paceGroupId !== target.id) {
      throw new TelegramConnectionError(
        'TOPIC_ALREADY_MAPPED',
        'This topic is already mapped to something else. Send /topic unmap here first.',
      );
    }

    try {
      // Re-mapping a pace group to a different topic replaces the old mapping.
      await tx
        .delete(telegramChatTopics)
        .where(eq(telegramChatTopics.paceGroupId, target.id));
      await insertPaceMapping(
        tx,
        chat,
        { paceGroupId: target.id, expectedName, messageThreadId: threadId },
        threadId,
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new TelegramConnectionError(
          'TOPIC_ALREADY_MAPPED',
          'This topic is already mapped.',
        );
      }
      throw error;
    }
  });

  return {
    paceGroupName: group.name,
    expectedName,
    /** False when the topic's name was never seen, so it could not be checked. */
    nameVerified: topicName !== null,
  };
}

export async function mapAnnouncementTopic(
  executor: DbOrTx,
  input: { chatId: bigint; messageThreadId: number },
) {
  const threadId = threadIdSchema.parse(input.messageThreadId);
  const chat = await requireChatByChatId(executor, input.chatId);

  await executor.transaction(async (tx) => {
    const existing = await tx.query.telegramChatTopics.findFirst({
      where: and(
        eq(telegramChatTopics.telegramChatId, chat.id),
        eq(telegramChatTopics.messageThreadId, threadId),
      ),
    });
    if (existing && existing.kind !== 'announcement') {
      throw new TelegramConnectionError(
        'TOPIC_ALREADY_MAPPED',
        'This topic is already mapped to a pace group. Send /topic unmap here first.',
      );
    }
    await tx
      .delete(telegramChatTopics)
      .where(
        and(
          eq(telegramChatTopics.telegramChatId, chat.id),
          eq(telegramChatTopics.kind, 'announcement'),
        ),
      );
    await tx.insert(telegramChatTopics).values({
      telegramChatId: chat.id,
      messageThreadId: threadId,
      kind: 'announcement',
      name: 'Announcements',
    });
  });
}

/** Returns true when a mapping existed for that topic. */
export async function unmapTopic(
  executor: DbOrTx,
  input: { chatId: bigint; messageThreadId: number },
) {
  const threadId = threadIdSchema.parse(input.messageThreadId);
  const chat = await requireChatByChatId(executor, input.chatId);
  const deleted = await executor
    .delete(telegramChatTopics)
    .where(
      and(
        eq(telegramChatTopics.telegramChatId, chat.id),
        eq(telegramChatTopics.messageThreadId, threadId),
      ),
    )
    .returning({ id: telegramChatTopics.id });
  return deleted.length > 0;
}

export type MatchTopicsResult = {
  /** Pace groups newly mapped to an existing topic with the exact name. */
  matched: string[];
  /** Pace groups still waiting on the admin, each with what to do. */
  attention: { groupName: string; expectedName: string; hint: string }[];
  /** Pace groups that are mapped and correct (including the newly matched). */
  okCount: number;
};

/** Maps every pace group that has exactly one exactly-named topic. Caller holds the lock. */
async function applyReadyMatches(
  tx: DbOrTx,
  chat: TelegramChatRow,
  evaluations: PaceTopicEvaluation[],
): Promise<{
  matched: PaceTopicEvaluation[];
  remaining: PaceTopicEvaluation[];
}> {
  const matched: PaceTopicEvaluation[] = [];
  const remaining: PaceTopicEvaluation[] = [];
  for (const evaluation of evaluations) {
    if (
      evaluation.status !== 'ready_to_match' ||
      evaluation.messageThreadId === null
    ) {
      remaining.push(evaluation);
      continue;
    }
    try {
      await insertPaceMapping(tx, chat, evaluation, evaluation.messageThreadId);
      matched.push(evaluation);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      remaining.push(evaluation);
    }
  }
  return { matched, remaining };
}

function summarize(
  matched: PaceTopicEvaluation[],
  remaining: PaceTopicEvaluation[],
): MatchTopicsResult {
  return {
    matched: matched.map((m) => m.groupName),
    attention: remaining
      .filter((r) => needsAttention(r.status) && r.hint !== null)
      .map((r) => ({
        groupName: r.groupName,
        expectedName: r.expectedName,
        hint: r.hint as string,
      })),
    okCount:
      matched.length + remaining.filter((r) => r.status === 'mapped').length,
  };
}

/**
 * The "Match topics" button: connects each pace group to the Telegram topic that
 * carries its exact name ("Nur · 20 pages") and reports everything else so the
 * admin knows precisely what to fix in Telegram.
 */
export async function matchPaceTopics(
  executor: DbOrTx,
  batchId: string,
): Promise<MatchTopicsResult> {
  batchIdSchema.parse(batchId);
  return executor.transaction(async (tx) => {
    await lockBatchTopics(tx, batchId);
    const chat = await requireChatByBatch(tx, batchId);
    const { evaluations } = await loadPaceTopicState(tx, chat);
    const { matched, remaining } = await applyReadyMatches(
      tx,
      chat,
      evaluations,
    );
    return summarize(matched, remaining);
  });
}

export type CreateTopicsResult = MatchTopicsResult & {
  /** Canonical names of topics created in Telegram. */
  created: string[];
  failed: { name: string; reason: string } | null;
};

/**
 * System side: matches existing topics by name first, then creates a topic named
 * exactly after each pace group that still has none. Only truly missing groups get
 * a topic; groups that need a human decision (wrong pace, duplicates) are reported.
 * Each topic is saved as soon as Telegram creates it, so a failure part-way keeps
 * the topics already made. Stops at the first Telegram error.
 */
export async function createMissingPaceTopics(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
): Promise<CreateTopicsResult> {
  batchIdSchema.parse(batchId);

  return executor.transaction(async (tx) => {
    await lockBatchTopics(tx, batchId);
    const chat = await requireChatByBatch(tx, batchId);
    requireWritableChat(chat);

    const { evaluations } = await loadPaceTopicState(tx, chat);
    const { matched, remaining } = await applyReadyMatches(
      tx,
      chat,
      evaluations,
    );

    const created: string[] = [];
    let failed: CreateTopicsResult['failed'] = null;
    const stillOpen: PaceTopicEvaluation[] = [];

    for (const evaluation of remaining) {
      if (evaluation.status !== 'missing' || failed) {
        stillOpen.push(evaluation);
        continue;
      }
      try {
        const topic = await api.createForumTopic(
          toApiChatId(chat.chatId),
          evaluation.expectedName,
        );
        await insertPaceMapping(tx, chat, evaluation, topic.messageThreadId);
        await upsertObservedTopic(tx, {
          telegramChatId: chat.id,
          messageThreadId: topic.messageThreadId,
          name: evaluation.expectedName,
          source: 'created',
        });
        created.push(evaluation.expectedName);
      } catch (error) {
        failed = {
          name: evaluation.expectedName,
          reason: describeTelegramError(error),
        };
        stillOpen.push(evaluation);
      }
    }

    const summary = summarize(matched, stillOpen);
    return {
      ...summary,
      okCount: summary.okCount + created.length,
      created,
      failed,
    };
  });
}

export type RenameTopicsResult = {
  renamed: string[];
  failed: { name: string; reason: string } | null;
};

/**
 * "Fix topic names": renames Telegram topics to the canonical name when they are
 * mapped but drifted (renamed, or the pace group's name/pace changed), or when
 * the group name matches but the pace is wrong. A wrong-pace topic is mapped
 * after it is renamed. Stops at the first Telegram error.
 */
export async function renamePaceTopics(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
): Promise<RenameTopicsResult> {
  batchIdSchema.parse(batchId);

  return executor.transaction(async (tx) => {
    await lockBatchTopics(tx, batchId);
    const chat = await requireChatByBatch(tx, batchId);
    requireWritableChat(chat);

    const { evaluations } = await loadPaceTopicState(tx, chat);
    const result: RenameTopicsResult = { renamed: [], failed: null };

    for (const evaluation of evaluations) {
      if (
        (evaluation.status !== 'name_mismatch' &&
          evaluation.status !== 'wrong_pace') ||
        evaluation.messageThreadId === null
      ) {
        continue;
      }
      try {
        await api.editForumTopic(
          toApiChatId(chat.chatId),
          evaluation.messageThreadId,
          evaluation.expectedName,
        );
        await upsertObservedTopic(tx, {
          telegramChatId: chat.id,
          messageThreadId: evaluation.messageThreadId,
          name: evaluation.expectedName,
          source: 'edited',
        });
        if (evaluation.status === 'wrong_pace') {
          await insertPaceMapping(
            tx,
            chat,
            evaluation,
            evaluation.messageThreadId,
          );
        }
        result.renamed.push(evaluation.expectedName);
      } catch (error) {
        result.failed = {
          name: evaluation.expectedName,
          reason: describeTelegramError(error),
        };
        break;
      }
    }
    return result;
  });
}

/** Posts a confirmation into the announcement topic (or General) to prove the link works. */
export async function sendTestMessage(
  executor: DbOrTx,
  api: TelegramApiPort,
  batchId: string,
) {
  batchIdSchema.parse(batchId);
  const chat = await requireChatByBatch(executor, batchId);
  const [batch, announcement] = await Promise.all([
    executor.query.batches.findFirst({
      where: eq(batches.id, batchId),
      columns: { name: true },
    }),
    executor.query.telegramChatTopics.findFirst({
      where: and(
        eq(telegramChatTopics.telegramChatId, chat.id),
        eq(telegramChatTopics.kind, 'announcement'),
      ),
    }),
  ]);

  try {
    await api.sendMessage(
      toApiChatId(chat.chatId),
      `✅ EMFS Book Shelf is connected to ${batch?.name ?? 'this batch'}.`,
      announcement?.messageThreadId,
    );
  } catch (error) {
    throw new TelegramConnectionError(
      'TELEGRAM_API_ERROR',
      `Telegram rejected the message: ${describeTelegramError(error)}`,
    );
  }
}
