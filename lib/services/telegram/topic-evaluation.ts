import {
  normalizeName,
  paceTopicName,
  topicHasGroupNameOnly,
  topicMatchesGroup,
} from './topic-names';

export type EvalGroup = { id: string; name: string; size: number };
/** A pace-group mapping that already exists. */
export type EvalMapping = { paceGroupId: string; messageThreadId: number };
/** A topic whose name the bot has read from Telegram. */
export type EvalObserved = { messageThreadId: number; name: string };

export type PaceTopicStatus =
  /** Mapped, and the topic name (if known) is correct. */
  | 'mapped'
  /** Mapped, but the topic is named differently now (renamed, or the pace group changed). */
  | 'name_mismatch'
  /** Not mapped; exactly one topic has the exact expected name. */
  | 'ready_to_match'
  /** Not mapped; several topics have the exact expected name. */
  | 'ambiguous'
  /** Not mapped; a topic has the right group name but another pages/day. */
  | 'wrong_pace'
  /** Not mapped; no topic with this name has been seen. */
  | 'missing'
  /** Two pace groups would need the same topic name; cannot be matched. */
  | 'duplicate_name';

export type PaceTopicEvaluation = {
  paceGroupId: string;
  groupName: string;
  expectedName: string;
  status: PaceTopicStatus;
  /** The mapped (or candidate) topic thread, when there is exactly one. */
  messageThreadId: number | null;
  observedName: string | null;
  /** What the admin should do, in plain words. Null when nothing is needed. */
  hint: string | null;
};

/** True for statuses the admin has to act on. */
export function needsAttention(status: PaceTopicStatus): boolean {
  return status !== 'mapped' && status !== 'ready_to_match';
}

/**
 * Pure comparison of the system's pace groups against what exists in Telegram.
 * The system is the source of truth: the topic must carry the pace group's
 * canonical name ("Nur · 20 pages").
 */
export function evaluatePaceTopics(input: {
  groups: EvalGroup[];
  mappings: EvalMapping[];
  observed: EvalObserved[];
}): PaceTopicEvaluation[] {
  const mappingByGroup = new Map(
    input.mappings.map((m) => [m.paceGroupId, m.messageThreadId]),
  );
  const mappedThreads = new Set(input.mappings.map((m) => m.messageThreadId));
  const observedByThread = new Map(
    input.observed.map((o) => [o.messageThreadId, o.name]),
  );

  const canonicalCount = new Map<string, number>();
  for (const g of input.groups) {
    const key = normalizeName(paceTopicName(g));
    canonicalCount.set(key, (canonicalCount.get(key) ?? 0) + 1);
  }

  return input.groups.map((group) => {
    const expectedName = paceTopicName(group);
    const base = {
      paceGroupId: group.id,
      groupName: group.name,
      expectedName,
    };

    const mappedThread = mappingByGroup.get(group.id);
    if (mappedThread !== undefined) {
      const observedName = observedByThread.get(mappedThread) ?? null;
      if (observedName !== null && !topicMatchesGroup(observedName, group)) {
        return {
          ...base,
          status: 'name_mismatch' as const,
          messageThreadId: mappedThread,
          observedName,
          hint: `The topic is named "${observedName}" but must be named "${expectedName}". Rename it in Telegram, or use "Fix topic names".`,
        };
      }
      return {
        ...base,
        status: 'mapped' as const,
        messageThreadId: mappedThread,
        observedName,
        hint: null,
      };
    }

    if ((canonicalCount.get(normalizeName(expectedName)) ?? 0) > 1) {
      return {
        ...base,
        status: 'duplicate_name' as const,
        messageThreadId: null,
        observedName: null,
        hint: `Another pace group in this batch has the same name and pace ("${expectedName}"). Rename one of them in the system so each topic name is unique.`,
      };
    }

    const free = input.observed.filter(
      (o) => !mappedThreads.has(o.messageThreadId),
    );
    const exact = free.filter((o) => topicMatchesGroup(o.name, group));
    if (exact.length === 1) {
      return {
        ...base,
        status: 'ready_to_match' as const,
        messageThreadId: exact[0].messageThreadId,
        observedName: exact[0].name,
        hint: null,
      };
    }
    if (exact.length > 1) {
      return {
        ...base,
        status: 'ambiguous' as const,
        messageThreadId: null,
        observedName: null,
        hint: `${exact.length} topics are named "${expectedName}". Delete or rename the extra ones in Telegram so only one remains.`,
      };
    }

    const near = free.filter((o) => topicHasGroupNameOnly(o.name, group));
    if (near.length === 1) {
      return {
        ...base,
        status: 'wrong_pace' as const,
        messageThreadId: near[0].messageThreadId,
        observedName: near[0].name,
        hint: `A topic named "${near[0].name}" has the wrong pace. This group reads ${group.size} pages/day. Rename the topic to "${expectedName}", or use "Fix topic names".`,
      };
    }

    return {
      ...base,
      status: 'missing' as const,
      messageThreadId: null,
      observedName: null,
      hint: `Create a topic named "${expectedName}" in the Telegram group (or use "Create missing topics"). If it already exists, rename it to exactly that. The bot can only read a topic's name when the topic is created or renamed, or when someone posts in it.`,
    };
  });
}
