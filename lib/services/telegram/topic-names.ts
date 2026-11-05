export function paceTopicName(group: { name: string; size: number }): string {
  return `${group.name.trim().replace(/\s+/g, ' ')} · ${group.size} pages`;
}

/** Case-, spacing- and Unicode-insensitive form used only for comparison. */
export function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
