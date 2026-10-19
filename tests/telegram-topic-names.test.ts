import { describe, expect, it } from 'vitest';
import {
  normalizeName,
  paceTopicName,
  parsePaceTopicName,
  topicHasGroupNameOnly,
  topicMatchesGroup,
} from '../lib/services/telegram/topic-names';

const nur = { name: 'Nur', size: 20 };

describe('paceTopicName', () => {
  it('builds "<name> · <pages> pages"', () => {
    expect(paceTopicName(nur)).toBe('Nur · 20 pages');
  });

  it('trims and collapses spaces in the group name', () => {
    expect(paceTopicName({ name: '  Early   Birds ', size: 5 })).toBe(
      'Early Birds · 5 pages',
    );
  });
});

describe('parsePaceTopicName', () => {
  it.each([
    ['Nur · 20 pages', 'Nur', 20],
    ['Nur - 20', 'Nur', 20],
    ['nur | 20 pg', 'nur', 20],
    ['Nur: 20p', 'Nur', 20],
    ['  Nur   —   20   pages ', 'Nur', 20],
    ['Al-Nur · 10 pages', 'Al-Nur', 10],
    ['Sakina – 40', 'Sakina', 40],
  ])('parses %j', (input, name, size) => {
    expect(parsePaceTopicName(input)).toEqual({ name, size });
  });

  it.each([
    'Book talk',
    'Announcements',
    'Nur',
    'Nur · 15 pages', // not one of 5/10/20/40
    'Nur · twenty pages',
    '20 pages',
    '',
  ])('rejects %j', (input) => {
    expect(parsePaceTopicName(input)).toBeNull();
  });
});

describe('topicMatchesGroup', () => {
  it('matches the canonical name and tolerant spellings', () => {
    expect(topicMatchesGroup('Nur · 20 pages', nur)).toBe(true);
    expect(topicMatchesGroup('NUR - 20', nur)).toBe(true);
    expect(topicMatchesGroup('  nur   |  20 pg ', nur)).toBe(true);
  });

  it('requires the same pages per day', () => {
    expect(topicMatchesGroup('Nur · 10 pages', nur)).toBe(false);
  });

  it('requires the same group name', () => {
    expect(topicMatchesGroup('Sakina · 20 pages', nur)).toBe(false);
    expect(topicMatchesGroup('Nur 2 · 20 pages', nur)).toBe(false);
  });

  it('never matches a free-form topic', () => {
    expect(topicMatchesGroup('Book talk', nur)).toBe(false);
  });
});

describe('topicHasGroupNameOnly', () => {
  it('flags the right name with the wrong pace', () => {
    expect(topicHasGroupNameOnly('Nur · 10 pages', nur)).toBe(true);
  });

  it('is false for an exact match or a different name', () => {
    expect(topicHasGroupNameOnly('Nur · 20 pages', nur)).toBe(false);
    expect(topicHasGroupNameOnly('Sakina · 10 pages', nur)).toBe(false);
  });
});

describe('normalizeName', () => {
  it('ignores case and spacing', () => {
    expect(normalizeName('  Nur   Group ')).toBe('nur group');
  });
});
