import { describe, expect, it } from 'vitest';
import {
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  LinkMode,
  consumeLinkCodeSchema,
  createLinkCodeActionSchema,
  createPaceGroupForDiscoveredTopicActionSchema,
  groupChatIdSchema,
  mapDiscoveredTopicActionSchema,
  parseLinkArgument,
  parseTopicCommand,
  telegramTopicNameSchema,
} from '../lib/validations/telegram';

describe('parseLinkArgument', () => {
  it('normalizes case and whitespace', () => {
    expect(parseLinkArgument('  abcd2345 ')).toBe('ABCD2345');
  });

  it.each(['', 'SHORT', 'ABCD234O', 'ABCD23456', 'abcd-234'])(
    'rejects %j',
    (raw) => {
      expect(parseLinkArgument(raw)).toBeNull();
    },
  );

  it('uses an alphabet without look-alike characters', () => {
    expect(LINK_CODE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(LINK_CODE_LENGTH).toBe(8);
  });
});

describe('parseTopicCommand', () => {
  it('parses pace with a multi-word name and collapses spaces', () => {
    expect(parseTopicCommand('pace  Early   Birds ')).toEqual({
      kind: 'pace',
      name: 'Early Birds',
    });
  });

  it('parses announcement and unmap case-insensitively', () => {
    expect(parseTopicCommand('Announcement')).toEqual({ kind: 'announcement' });
    expect(parseTopicCommand('UNMAP')).toEqual({ kind: 'unmap' });
  });

  it.each(['', 'pace', 'pace   ', 'delete', 'announcement now'])(
    'rejects %j',
    (raw) => {
      expect(parseTopicCommand(raw)).toBeNull();
    },
  );

  it('rejects an over-long pace name', () => {
    expect(parseTopicCommand(`pace ${'x'.repeat(200)}`)).toBeNull();
  });
});

describe('createLinkCodeActionSchema', () => {
  it('defaults the topic sync mode to managed when the form omits it', () => {
    expect(
      createLinkCodeActionSchema.parse({
        batchId: '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111',
      }),
    ).toEqual({
      batchId: '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111',
      topicSyncMode: 'managed',
    });
  });

  it.each(['managed', 'manual'] as const)(
    'accepts the database enum value %s',
    (mode) => {
      expect(LinkMode.parse(mode)).toBe(mode);
      expect(
        createLinkCodeActionSchema.parse({
          batchId: '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111',
          topicSyncMode: mode,
        }).topicSyncMode,
      ).toBe(mode);
    },
  );

  it('rejects values outside the database enum', () => {
    expect(
      createLinkCodeActionSchema.safeParse({
        batchId: '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111',
        topicSyncMode: 'unmanaged',
      }).success,
    ).toBe(false);
  });
});

describe('groupChatIdSchema', () => {
  it('accepts supergroup ids beyond 32 bits', () => {
    expect(groupChatIdSchema.parse(BigInt('-1001234567890'))).toBe(
      BigInt('-1001234567890'),
    );
  });

  it('rejects private chat ids (positive)', () => {
    expect(groupChatIdSchema.safeParse(BigInt(12345)).success).toBe(false);
  });
});

describe('mapDiscoveredTopicActionSchema', () => {
  it('requires valid identifiers for a discovered topic and pace group', () => {
    const batchId = '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111';
    const discoveryId = '4f2b8f0e-6a52-4a7e-9c55-0d1d9f6a2222';
    const paceGroupId = '5f2b8f0e-6a52-4a7e-9c55-0d1d9f6a3333';

    expect(
      mapDiscoveredTopicActionSchema.parse({
        batchId,
        discoveryId,
        paceGroupId,
      }),
    ).toEqual({ batchId, discoveryId, paceGroupId });
    expect(
      mapDiscoveredTopicActionSchema.safeParse({
        batchId,
        discoveryId,
        paceGroupId: 'invalid',
      }).success,
    ).toBe(false);
  });

  describe('telegramTopicNameSchema', () => {
    it('trims valid topic names and rejects empty or overlong names', () => {
      expect(telegramTopicNameSchema.parse('  Existing group  ')).toBe(
        'Existing group',
      );
      expect(telegramTopicNameSchema.safeParse('   ').success).toBe(false);
      expect(telegramTopicNameSchema.safeParse('x'.repeat(129)).success).toBe(
        false,
      );
    });
  });

  describe('createPaceGroupForDiscoveredTopicActionSchema', () => {
    it('accepts the existing pace-group values with a discovery ID', () => {
      expect(
        createPaceGroupForDiscoveredTopicActionSchema.parse({
          batchId: '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111',
          discoveryId: '4f2b8f0e-6a52-4a7e-9c55-0d1d9f6a2222',
          name: '  Reading 10 ',
          size: '10',
        }),
      ).toEqual({
        batchId: '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111',
        discoveryId: '4f2b8f0e-6a52-4a7e-9c55-0d1d9f6a2222',
        name: 'Reading 10',
        size: 10,
      });
    });

    it('rejects unsupported pace sizes', () => {
      expect(
        createPaceGroupForDiscoveredTopicActionSchema.safeParse({
          batchId: '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111',
          discoveryId: '4f2b8f0e-6a52-4a7e-9c55-0d1d9f6a2222',
          name: 'Reading 12',
          size: 12,
        }).success,
      ).toBe(false);
    });
  });
});

describe('consumeLinkCodeSchema', () => {
  it('turns an empty title into null and normalizes the code', () => {
    const parsed = consumeLinkCodeSchema.parse({
      code: 'abcd2345',
      chatId: BigInt(-100123),
      title: '  ',
      isForum: true,
      canManageTopics: false,
    });
    expect(parsed.code).toBe('ABCD2345');
    expect(parsed.title).toBeNull();
  });
});
