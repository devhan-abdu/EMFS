import { describe, expect, it } from 'vitest';
import {
  recordObservedTopic,
  upsertObservedTopic,
} from '../lib/services/telegram/observed-topics';
import { makeFakeExecutor } from './helpers/fake-executor';

const CHAT_ID = BigInt('-1001234567890');
const CHAT_ROW_ID = '7c1d2e3f-0000-4000-8000-000000000001';

describe('recordObservedTopic', () => {
  it('ignores groups that are not linked', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [undefined] },
    });
    const stored = await recordObservedTopic(executor, {
      chatId: CHAT_ID,
      messageThreadId: 5,
      name: 'Nur · 20 pages',
      source: 'created',
    });
    expect(stored).toBe(false);
    expect(executor.inserted).toEqual([]);
  });

  it('stores the topic name for a linked group', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [{ id: CHAT_ROW_ID }] },
    });
    const stored = await recordObservedTopic(executor, {
      chatId: CHAT_ID,
      messageThreadId: 5,
      name: '  Nur · 20 pages ',
      source: 'edited',
    });
    expect(stored).toBe(true);
    expect(executor.inserted[0]).toEqual({
      telegramChatId: CHAT_ROW_ID,
      messageThreadId: 5,
      name: 'Nur · 20 pages',
      nameSource: 'edited',
    });
  });

  it('rejects a positive (non-group) chat id', async () => {
    const executor = makeFakeExecutor();
    await expect(
      recordObservedTopic(executor, {
        chatId: BigInt(5),
        messageThreadId: 5,
        name: 'x',
        source: 'reply',
      }),
    ).rejects.toThrow();
  });
});

describe('upsertObservedTopic', () => {
  it('rejects an invalid thread id and an empty or over-long name', async () => {
    const executor = makeFakeExecutor();
    const base = {
      telegramChatId: CHAT_ROW_ID,
      messageThreadId: 5,
      name: 'ok',
      source: 'reply' as const,
    };
    await expect(
      upsertObservedTopic(executor, { ...base, messageThreadId: 0 }),
    ).rejects.toThrow();
    await expect(
      upsertObservedTopic(executor, { ...base, name: '   ' }),
    ).rejects.toThrow();
    await expect(
      upsertObservedTopic(executor, { ...base, name: 'x'.repeat(129) }),
    ).rejects.toThrow();
  });
});
