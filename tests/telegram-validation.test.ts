import { describe, expect, it } from 'vitest';
import {
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  consumeLinkCodeSchema,
  groupChatIdSchema,
  parseLinkArgument,
  parseTopicCommand,
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

  it.each(['', 'delete', 'announcement now'])('rejects %j', (raw) => {
    expect(parseTopicCommand(raw)).toBeNull();
  });

  it('treats "pace" alone as "use this topic\'s own name"', () => {
    expect(parseTopicCommand('pace')).toEqual({ kind: 'pace', name: null });
    expect(parseTopicCommand('  PACE  ')).toEqual({ kind: 'pace', name: null });
  });

  it('rejects an over-long pace name', () => {
    expect(parseTopicCommand(`pace ${'x'.repeat(200)}`)).toBeNull();
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
