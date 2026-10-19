import { PACE_GROUP_SIZE_PRESETS } from '@/lib/validations/pace-group';

/**
 * A pace group's Telegram topic must be named exactly like this, so the system
 * can match topics to pace groups by name: "<pace group name> · <pages/day> pages".
 */
export function paceTopicName(group: { name: string; size: number }): string {
  return `${group.name.trim().replace(/\s+/g, ' ')} · ${group.size} pages`;
}

/** Case-, spacing- and Unicode-insensitive form used only for comparison. */
export function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// "<name> <separator> <number> [pages|pg|p]". Separators people actually type.
const TOPIC_NAME_PATTERN =
  /^(.+?)\s*[·•|\-–—:]\s*(\d{1,3})\s*(?:pages?|pgs?|p)?$/iu;

/**
 * Splits a topic name into pace group name and pages/day. Returns null when the
 * name does not carry a valid pace (5, 10, 20 or 40), e.g. "Book talk".
 */
export function parsePaceTopicName(
  topicName: string,
): { name: string; size: number } | null {
  const match = TOPIC_NAME_PATTERN.exec(
    topicName.normalize('NFKC').trim().replace(/\s+/g, ' '),
  );
  if (!match) return null;
  const size = Number(match[2]);
  if (!(PACE_GROUP_SIZE_PRESETS as readonly number[]).includes(size)) {
    return null;
  }
  return { name: match[1].trim(), size };
}

export function topicMatchesGroup(
  topicName: string,
  group: { name: string; size: number },
): boolean {
  const parsed = parsePaceTopicName(topicName);
  return (
    parsed !== null &&
    parsed.size === group.size &&
    normalizeName(parsed.name) === normalizeName(group.name)
  );
}

/** Same pace group name but a different pages/day, i.e. a fixable near miss. */
export function topicHasGroupNameOnly(
  topicName: string,
  group: { name: string; size: number },
): boolean {
  const parsed = parsePaceTopicName(topicName);
  return (
    parsed !== null &&
    parsed.size !== group.size &&
    normalizeName(parsed.name) === normalizeName(group.name)
  );
}
