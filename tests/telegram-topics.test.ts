import { describe, expect, it, vi } from 'vitest';
import {
  createMissingPaceTopics,
  mapAnnouncementTopic,
  mapPaceTopic,
  sendTestMessage,
  unmapTopic,
} from '../lib/services/telegram/topics';
import type { TelegramApiPort } from '../lib/services/telegram/api-port';
import { makeFakeExecutor } from './helpers/fake-executor';

const BATCH_ID = '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111';
const CHAT_ROW_ID = '7c1d2e3f-0000-4000-8000-000000000001';
const CHAT_ID = BigInt('-1001234567890');

const readyChat = {
  id: CHAT_ROW_ID,
  chatId: CHAT_ID,
  batchId: BATCH_ID,
  status: 'active',
  isForum: true,
  canManageTopics: true,
};

const makePort = (
  overrides: Partial<TelegramApiPort> = {},
): TelegramApiPort => ({
  getMe: async () => ({ id: 99 }),
  getChat: async () => ({ title: 't', isForum: true }),
  getChatMember: async () => ({
    status: 'administrator',
    canManageTopics: true,
  }),
  createForumTopic: vi.fn(async () => ({ messageThreadId: 1 })),
  sendMessage: vi.fn(async () => {}),
  ...overrides,
});

describe('createMissingPaceTopics', () => {
  it('fails with NOT_CONNECTED when the batch has no chat', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [undefined] },
    });
    await expect(
      createMissingPaceTopics(executor, makePort(), BATCH_ID),
    ).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('refuses when Topics are off', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [{ ...readyChat, isForum: false }] },
    });
    await expect(
      createMissingPaceTopics(executor, makePort(), BATCH_ID),
    ).rejects.toMatchObject({ code: 'NOT_A_FORUM' });
  });

  it('refuses when the bot lacks the Manage topics right', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [{ ...readyChat, canManageTopics: false }] },
    });
    await expect(
      createMissingPaceTopics(executor, makePort(), BATCH_ID),
    ).rejects.toMatchObject({ code: 'TELEGRAM_API_ERROR' });
  });

  it('refuses when the bot was removed from the group', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [{ ...readyChat, status: 'bot_removed' }] },
    });
    await expect(
      createMissingPaceTopics(executor, makePort(), BATCH_ID),
    ).rejects.toMatchObject({ code: 'TELEGRAM_API_ERROR' });
  });

  it('creates topics only for pace groups that have none, and saves each', async () => {
    const createForumTopic = vi
      .fn<TelegramApiPort['createForumTopic']>()
      .mockResolvedValueOnce({ messageThreadId: 21 })
      .mockResolvedValueOnce({ messageThreadId: 22 });
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: {
        paceGroups: [
          [
            { id: 'g1', name: 'Alpha' },
            { id: 'g2', name: 'Beta' },
            { id: 'g3', name: 'Gamma' },
          ],
        ],
        telegramChatTopics: [[{ paceGroupId: 'g1' }]],
      },
    });

    const result = await createMissingPaceTopics(
      executor,
      makePort({ createForumTopic }),
      BATCH_ID,
    );

    expect(result).toEqual({ created: ['Beta', 'Gamma'], failed: null });
    expect(createForumTopic).toHaveBeenCalledTimes(2);
    expect(createForumTopic).toHaveBeenNthCalledWith(1, -1001234567890, 'Beta');
    expect(executor.inserted).toEqual([
      expect.objectContaining({
        paceGroupId: 'g2',
        messageThreadId: 21,
        kind: 'pace_group',
      }),
      expect.objectContaining({
        paceGroupId: 'g3',
        messageThreadId: 22,
        kind: 'pace_group',
      }),
    ]);
  });

  it('stops at the first Telegram error and keeps topics already created', async () => {
    const createForumTopic = vi
      .fn<TelegramApiPort['createForumTopic']>()
      .mockResolvedValueOnce({ messageThreadId: 31 })
      .mockRejectedValueOnce({ description: 'Bad Request: not enough rights' });
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: {
        paceGroups: [
          [
            { id: 'g1', name: 'Alpha' },
            { id: 'g2', name: 'Beta' },
            { id: 'g3', name: 'Gamma' },
          ],
        ],
        telegramChatTopics: [[]],
      },
    });

    const result = await createMissingPaceTopics(
      executor,
      makePort({ createForumTopic }),
      BATCH_ID,
    );

    expect(result.created).toEqual(['Alpha']);
    expect(result.failed).toEqual({
      name: 'Beta',
      reason: 'Bad Request: not enough rights',
    });
    expect(createForumTopic).toHaveBeenCalledTimes(2);
    expect(executor.inserted).toHaveLength(1);
  });

  it('serializes concurrent runs with an advisory lock', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: { paceGroups: [[]], telegramChatTopics: [[]] },
    });
    await createMissingPaceTopics(executor, makePort(), BATCH_ID);
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });
});

describe('mapPaceTopic', () => {
  const input = {
    chatId: CHAT_ID,
    messageThreadId: 7,
    paceGroupName: 'alpha',
  };

  it('fails when the group is not linked yet', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [undefined] },
    });
    await expect(mapPaceTopic(executor, input)).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    });
  });

  it('lists the available names when the pace group is not found', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat], paceGroups: [undefined] },
      many: { paceGroups: [[{ name: 'Alpha' }, { name: 'Beta' }]] },
    });
    await expect(mapPaceTopic(executor, input)).rejects.toMatchObject({
      code: 'PACE_GROUP_NOT_FOUND',
      message: expect.stringContaining('Alpha, Beta'),
    });
  });

  it('refuses a topic already mapped to a different pace group', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        paceGroups: [{ id: 'g1', name: 'Alpha' }],
        telegramChatTopics: [{ paceGroupId: 'g2', kind: 'pace_group' }],
      },
    });
    await expect(mapPaceTopic(executor, input)).rejects.toMatchObject({
      code: 'TOPIC_ALREADY_MAPPED',
    });
  });

  it('maps the topic and returns the canonical pace group name', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        paceGroups: [{ id: 'g1', name: 'Alpha' }],
        telegramChatTopics: [undefined],
      },
    });
    const result = await mapPaceTopic(executor, input);
    expect(result.paceGroupName).toBe('Alpha');
    expect(executor.inserted[0]).toMatchObject({
      paceGroupId: 'g1',
      messageThreadId: 7,
      kind: 'pace_group',
    });
  });

  it('rejects an invalid thread id', async () => {
    const executor = makeFakeExecutor();
    await expect(
      mapPaceTopic(executor, { ...input, messageThreadId: 0 }),
    ).rejects.toThrow();
  });
});

describe('mapAnnouncementTopic / unmapTopic', () => {
  it('refuses to turn a pace topic into the announcement topic', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        telegramChatTopics: [{ kind: 'pace_group', paceGroupId: 'g1' }],
      },
    });
    await expect(
      mapAnnouncementTopic(executor, { chatId: CHAT_ID, messageThreadId: 9 }),
    ).rejects.toMatchObject({ code: 'TOPIC_ALREADY_MAPPED' });
  });

  it('maps the announcement topic', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat], telegramChatTopics: [undefined] },
    });
    await mapAnnouncementTopic(executor, {
      chatId: CHAT_ID,
      messageThreadId: 9,
    });
    expect(executor.inserted[0]).toMatchObject({
      kind: 'announcement',
      messageThreadId: 9,
    });
  });

  it('unmap reports whether anything was removed', async () => {
    const removed = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      deletes: [[{ id: 't1' }]],
    });
    expect(
      await unmapTopic(removed, { chatId: CHAT_ID, messageThreadId: 9 }),
    ).toBe(true);

    const none = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      deletes: [[]],
    });
    expect(
      await unmapTopic(none, { chatId: CHAT_ID, messageThreadId: 9 }),
    ).toBe(false);
  });
});

describe('sendTestMessage', () => {
  it('posts into the announcement topic when one is mapped', async () => {
    const sendMessage = vi.fn<TelegramApiPort['sendMessage']>(async () => {});
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        batches: [{ name: 'Batch 5' }],
        telegramChatTopics: [{ kind: 'announcement', messageThreadId: 5 }],
      },
    });
    await sendTestMessage(executor, makePort({ sendMessage }), BATCH_ID);
    expect(sendMessage).toHaveBeenCalledWith(
      -1001234567890,
      expect.stringContaining('Batch 5'),
      5,
    );
  });

  it('posts to General (no thread) when no announcement topic exists', async () => {
    const sendMessage = vi.fn<TelegramApiPort['sendMessage']>(async () => {});
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        batches: [{ name: 'Batch 5' }],
        telegramChatTopics: [undefined],
      },
    });
    await sendTestMessage(executor, makePort({ sendMessage }), BATCH_ID);
    expect(sendMessage).toHaveBeenCalledWith(
      -1001234567890,
      expect.any(String),
      undefined,
    );
  });

  it('wraps Telegram failures in a TELEGRAM_API_ERROR', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        batches: [{ name: 'Batch 5' }],
        telegramChatTopics: [undefined],
      },
    });
    await expect(
      sendTestMessage(
        executor,
        makePort({
          sendMessage: async () => {
            throw { description: 'Forbidden: bot was kicked' };
          },
        }),
        BATCH_ID,
      ),
    ).rejects.toMatchObject({
      code: 'TELEGRAM_API_ERROR',
      message: expect.stringContaining('bot was kicked'),
    });
  });
});
