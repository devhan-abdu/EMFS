export function paceTopicName(group: {
  name: string;
  min_pages: number;
  max_pages: number;
}): string {
  const pace =
    group.min_pages === group.max_pages
      ? `${group.max_pages} pages`
      : `${group.min_pages}–${group.max_pages} pages`;
  return `${group.name.trim().replace(/\s+/g, ' ')} · ${pace}`;
}

/** Case-, spacing- and Unicode-insensitive form used only for comparison. */
export function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
