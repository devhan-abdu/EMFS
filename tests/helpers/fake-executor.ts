import { vi } from 'vitest';
import type { DbOrTx } from '@/lib/services/membership';

type Row = Record<string, unknown>;

export type FakeScript = {
  /** Results for `.update(...).returning()` calls, in order. */
  updates?: Row[][];
  /** Results for `.insert(...).values(...).returning()` calls, in order. */
  inserts?: Row[][];
  /** Results for `.delete(...).returning()` calls, in order. */
  deletes?: Row[][];
  /** Per-table queues for query.<table>.findFirst / findMany, in order. */
  first?: Partial<Record<TableName, (Row | undefined)[]>>;
  many?: Partial<Record<TableName, Row[][]>>;
};

type TableName =
  | 'batches'
  | 'paceGroups'
  | 'telegramChats'
  | 'telegramChatTopics'
  | 'telegramObservedTopics'
  | 'telegramLinkCodes';

const TABLES: TableName[] = [
  'batches',
  'paceGroups',
  'telegramChats',
  'telegramChatTopics',
  'telegramObservedTopics',
  'telegramLinkCodes',
];

/** A chainable query builder that is also awaitable. */
function builder(result: unknown, onValues?: (v: unknown) => void) {
  const self: Record<string, unknown> = {};
  for (const method of [
    'set',
    'where',
    'returning',
    'from',
    'orderBy',
    'limit',
    'onConflictDoNothing',
    'onConflictDoUpdate',
  ]) {
    self[method] = () => self;
  }
  self.values = (v: unknown) => {
    onValues?.(v);
    return self;
  };
  self.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return self;
}

/**
 * Minimal scripted stand-in for a Drizzle executor. Mock only the DB boundary;
 * services and Zod schemas run for real.
 */
export function makeFakeExecutor(script: FakeScript = {}) {
  const updates = [...(script.updates ?? [])];
  const inserts = [...(script.inserts ?? [])];
  const deletes = [...(script.deletes ?? [])];
  const inserted: unknown[] = [];

  const query: Record<string, unknown> = {};
  for (const table of TABLES) {
    const first = [...(script.first?.[table] ?? [])];
    const many = [...(script.many?.[table] ?? [])];
    query[table] = {
      findFirst: vi.fn(async () => first.shift()),
      findMany: vi.fn(async () => many.shift() ?? []),
    };
  }

  const executor: Record<string, unknown> = {
    query,
    inserted,
    execute: vi.fn(async () => []),
    update: vi.fn(() => builder(updates.shift() ?? [])),
    insert: vi.fn(() =>
      builder(inserts.shift() ?? [], (v) => inserted.push(v)),
    ),
    delete: vi.fn(() => builder(deletes.shift() ?? [])),
  };
  executor.transaction = async (cb: (tx: unknown) => Promise<unknown>) =>
    cb(executor);

  return executor as unknown as DbOrTx & { inserted: unknown[] };
}
