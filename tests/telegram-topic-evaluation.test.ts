import { describe, expect, it } from 'vitest';
import {
  evaluatePaceTopics,
  needsAttention,
} from '../lib/services/telegram/topic-evaluation';

const groups = [
  { id: 'g1', name: 'Nur', size: 20 },
  { id: 'g2', name: 'Sakina', size: 10 },
];

const statusOf = (result: ReturnType<typeof evaluatePaceTopics>, id: string) =>
  result.find((r) => r.paceGroupId === id);

describe('evaluatePaceTopics', () => {
  it('marks a mapped group with the right name as mapped', () => {
    const result = evaluatePaceTopics({
      groups: [groups[0]],
      mappings: [{ paceGroupId: 'g1', messageThreadId: 11 }],
      observed: [{ messageThreadId: 11, name: 'Nur · 20 pages' }],
    });
    expect(result[0]).toMatchObject({
      status: 'mapped',
      messageThreadId: 11,
      hint: null,
    });
  });

  it('keeps a mapped group mapped when its name was never read', () => {
    const result = evaluatePaceTopics({
      groups: [groups[0]],
      mappings: [{ paceGroupId: 'g1', messageThreadId: 11 }],
      observed: [],
    });
    expect(result[0]).toMatchObject({ status: 'mapped', observedName: null });
  });

  it('flags a mapped topic that was renamed or whose pace changed', () => {
    const result = evaluatePaceTopics({
      groups: [{ id: 'g1', name: 'Nur', size: 40 }],
      mappings: [{ paceGroupId: 'g1', messageThreadId: 11 }],
      observed: [{ messageThreadId: 11, name: 'Nur · 20 pages' }],
    });
    expect(result[0].status).toBe('name_mismatch');
    expect(result[0].hint).toContain('"Nur · 40 pages"');
    expect(result[0].hint).toContain('"Nur · 20 pages"');
  });

  it('offers a match when exactly one topic has the exact name', () => {
    const result = evaluatePaceTopics({
      groups: [groups[0]],
      mappings: [],
      observed: [
        { messageThreadId: 5, name: 'Book talk' },
        { messageThreadId: 12, name: 'nur - 20 pages' },
      ],
    });
    expect(result[0]).toMatchObject({
      status: 'ready_to_match',
      messageThreadId: 12,
    });
    expect(needsAttention(result[0].status)).toBe(false);
  });

  it('reports duplicate topics instead of guessing', () => {
    const result = evaluatePaceTopics({
      groups: [groups[0]],
      mappings: [],
      observed: [
        { messageThreadId: 12, name: 'Nur · 20 pages' },
        { messageThreadId: 13, name: 'Nur - 20' },
      ],
    });
    expect(result[0].status).toBe('ambiguous');
    expect(result[0].messageThreadId).toBeNull();
  });

  it('reports the right name with the wrong pace and the fix', () => {
    const result = evaluatePaceTopics({
      groups: [groups[0]],
      mappings: [],
      observed: [{ messageThreadId: 12, name: 'Nur · 10 pages' }],
    });
    expect(result[0]).toMatchObject({
      status: 'wrong_pace',
      messageThreadId: 12,
    });
    expect(result[0].hint).toContain('20 pages/day');
  });

  it('tells the admin the exact topic to create when nothing matches', () => {
    const result = evaluatePaceTopics({
      groups: [groups[1]],
      mappings: [],
      observed: [{ messageThreadId: 5, name: 'Book talk' }],
    });
    expect(result[0].status).toBe('missing');
    expect(result[0].hint).toContain('"Sakina · 10 pages"');
  });

  it('does not match a topic that is already mapped to another group', () => {
    const result = evaluatePaceTopics({
      groups,
      mappings: [{ paceGroupId: 'g2', messageThreadId: 12 }],
      observed: [{ messageThreadId: 12, name: 'Nur · 20 pages' }],
    });
    expect(statusOf(result, 'g1')?.status).toBe('missing');
  });

  it('refuses to match two pace groups that need the same topic name', () => {
    const result = evaluatePaceTopics({
      groups: [
        { id: 'g1', name: 'Nur', size: 20 },
        { id: 'g2', name: 'nur', size: 20 },
      ],
      mappings: [],
      observed: [{ messageThreadId: 12, name: 'Nur · 20 pages' }],
    });
    expect(result.map((r) => r.status)).toEqual([
      'duplicate_name',
      'duplicate_name',
    ]);
  });

  it('keeps one result per pace group, in order', () => {
    const result = evaluatePaceTopics({ groups, mappings: [], observed: [] });
    expect(result.map((r) => r.paceGroupId)).toEqual(['g1', 'g2']);
    expect(result.every((r) => needsAttention(r.status))).toBe(true);
  });
});
