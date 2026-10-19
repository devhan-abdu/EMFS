import { describe, expect, it, vi } from 'vitest';
import {
  createMissingPaceTopics,
  mapAnnouncementTopic,
  mapPaceTopic,
  matchPaceTopics,
  renamePaceTopics,
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
  editForumTopic: vi.fn(async () => {}),
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

  it('matches existing topics by name, then creates only the truly missing ones with canonical names', async () => {
    const createForumTopic = vi
      .fn<TelegramApiPort['createForumTopic']>()
      .mockResolvedValueOnce({ messageThreadId: 22 });
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: {
        paceGroups: [
          [
            { id: 'g1', name: 'Alpha', size: 20 },
            { id: 'g2', name: 'Beta', size: 10 },
            { id: 'g3', name: 'Gamma', size: 5 },
          ],
        ],
        telegramChatTopics: [[{ paceGroupId: 'g1', messageThreadId: 11 }]],
        // Beta's topic already exists in Telegram with the exact name.
        telegramObservedTopics: [
          [
            { messageThreadId: 11, name: 'Alpha · 20 pages' },
            { messageThreadId: 12, name: 'beta - 10 pages' },
          ],
        ],
      },
    });

    const result = await createMissingPaceTopics(
      executor,
      makePort({ createForumTopic }),
      BATCH_ID,
    );

    expect(result.matched).toEqual(['Beta']);
    expect(result.created).toEqual(['Gamma · 5 pages']);
    expect(result.failed).toBeNull();
    expect(result.attention).toEqual([]);
    expect(createForumTopic).toHaveBeenCalledTimes(1);
    expect(createForumTopic).toHaveBeenCalledWith(
      -1001234567890,
      'Gamma · 5 pages',
    );
    expect(executor.inserted).toEqual([
      expect.objectContaining({ paceGroupId: 'g2', messageThreadId: 12 }),
      expect.objectContaining({ paceGroupId: 'g3', messageThreadId: 22 }),
      // the created topic's name is remembered so it is not re-created
      expect.objectContaining({ messageThreadId: 22, name: 'Gamma · 5 pages' }),
    ]);
  });

  it('does not create topics for groups that need a human decision', async () => {
    const createForumTopic = vi.fn<TelegramApiPort['createForumTopic']>();
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: {
        paceGroups: [[{ id: 'g1', name: 'Alpha', size: 20 }]],
        telegramChatTopics: [[]],
        telegramObservedTopics: [
          [{ messageThreadId: 12, name: 'Alpha · 10 pages' }],
        ],
      },
    });

    const result = await createMissingPaceTopics(
      executor,
      makePort({ createForumTopic }),
      BATCH_ID,
    );

    expect(createForumTopic).not.toHaveBeenCalled();
    expect(result.created).toEqual([]);
    expect(result.attention).toEqual([
      expect.objectContaining({
        groupName: 'Alpha',
        hint: expect.stringContaining('wrong pace'),
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
            { id: 'g1', name: 'Alpha', size: 20 },
            { id: 'g2', name: 'Beta', size: 20 },
            { id: 'g3', name: 'Gamma', size: 20 },
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

    expect(result.created).toEqual(['Alpha · 20 pages']);
    expect(result.failed).toEqual({
      name: 'Beta · 20 pages',
      reason: 'Bad Request: not enough rights',
    });
    expect(createForumTopic).toHaveBeenCalledTimes(2);
    // one mapping + one remembered name, nothing for Beta or Gamma
    expect(executor.inserted).toHaveLength(2);
    expect(result.attention.map((a) => a.groupName)).toEqual(['Beta', 'Gamma']);
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
  const alpha = { id: 'g1', name: 'Alpha', size: 20 };

  it('fails when the group is not linked yet', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [undefined] },
    });
    await expect(mapPaceTopic(executor, input)).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    });
  });

  it('lists the exact topic names when the pace group is not found', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        telegramObservedTopics: [undefined],
      },
      many: {
        paceGroups: [
          [],
          [
            { id: 'g1', name: 'Alpha', size: 20 },
            { id: 'g2', name: 'Beta', size: 10 },
          ],
        ],
      },
    });
    await expect(mapPaceTopic(executor, input)).rejects.toMatchObject({
      code: 'PACE_GROUP_NOT_FOUND',
      message: expect.stringContaining('Alpha · 20 pages, Beta · 10 pages'),
    });
  });

  it('asks for the full name when two pace groups share a name', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        telegramObservedTopics: [undefined],
      },
      many: {
        paceGroups: [[alpha, { id: 'g9', name: 'Alpha', size: 10 }]],
      },
    });
    await expect(mapPaceTopic(executor, input)).rejects.toMatchObject({
      code: 'PACE_GROUP_AMBIGUOUS',
      message: expect.stringContaining('Alpha · 20 pages'),
    });
  });

  it('refuses a topic already mapped to a different pace group', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        telegramObservedTopics: [undefined],
        telegramChatTopics: [{ paceGroupId: 'g2', kind: 'pace_group' }],
      },
      many: { paceGroups: [[alpha]] },
    });
    await expect(mapPaceTopic(executor, input)).rejects.toMatchObject({
      code: 'TOPIC_ALREADY_MAPPED',
    });
  });

  it('enforces the topic name: a wrongly named topic is rejected with the exact name to use', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: { paceGroups: [[alpha]] },
    });
    await expect(
      mapPaceTopic(executor, { ...input, topicName: 'Alpha · 10 pages' }),
    ).rejects.toMatchObject({
      code: 'TOPIC_NAME_MISMATCH',
      message: expect.stringContaining('"Alpha · 20 pages"'),
    });
  });

  it("maps by the topic's own name when no group name is given", async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat], telegramChatTopics: [undefined] },
      many: {
        paceGroups: [[alpha, { id: 'g2', name: 'Beta', size: 10 }]],
      },
    });
    const result = await mapPaceTopic(executor, {
      chatId: CHAT_ID,
      messageThreadId: 7,
      paceGroupName: null,
      topicName: 'alpha - 20',
    });
    expect(result).toMatchObject({
      paceGroupName: 'Alpha',
      expectedName: 'Alpha · 20 pages',
      nameVerified: true,
    });
    expect(executor.inserted[0]).toMatchObject({
      paceGroupId: 'g1',
      messageThreadId: 7,
      kind: 'pace_group',
    });
  });

  it('refuses to guess when the topic name matches no pace group', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: { paceGroups: [[alpha]] },
    });
    await expect(
      mapPaceTopic(executor, {
        chatId: CHAT_ID,
        messageThreadId: 7,
        paceGroupName: null,
        topicName: 'Book talk',
      }),
    ).rejects.toMatchObject({
      code: 'PACE_GROUP_NOT_FOUND',
      message: expect.stringContaining('Alpha · 20 pages'),
    });
  });

  it('maps with a warning when the topic name was never seen', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [readyChat],
        telegramObservedTopics: [undefined],
        telegramChatTopics: [undefined],
      },
      many: { paceGroups: [[alpha]] },
    });
    const result = await mapPaceTopic(executor, input);
    expect(result.paceGroupName).toBe('Alpha');
    expect(result.nameVerified).toBe(false);
  });

  it('rejects an invalid thread id', async () => {
    const executor = makeFakeExecutor();
    await expect(
      mapPaceTopic(executor, { ...input, messageThreadId: 0 }),
    ).rejects.toThrow();
  });
});

describe('matchPaceTopics', () => {
  it('maps exact-name topics and reports what the admin must fix', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: {
        paceGroups: [
          [
            { id: 'g1', name: 'Alpha', size: 20 },
            { id: 'g2', name: 'Beta', size: 10 },
            { id: 'g3', name: 'Gamma', size: 5 },
          ],
        ],
        telegramChatTopics: [[]],
        telegramObservedTopics: [
          [
            { messageThreadId: 11, name: 'Alpha · 20 pages' },
            { messageThreadId: 12, name: 'Beta · 20 pages' },
            { messageThreadId: 99, name: 'Book talk' },
          ],
        ],
      },
    });

    const result = await matchPaceTopics(executor, BATCH_ID);

    expect(result.matched).toEqual(['Alpha']);
    expect(result.okCount).toBe(1);
    expect(result.attention.map((a) => a.groupName)).toEqual(['Beta', 'Gamma']);
    expect(result.attention[0].hint).toContain('"Beta · 10 pages"');
    expect(result.attention[1].hint).toContain(
      'Create a topic named "Gamma · 5 pages"',
    );
    expect(executor.inserted).toEqual([
      expect.objectContaining({ paceGroupId: 'g1', messageThreadId: 11 }),
    ]);
  });

  it('is idempotent: already-mapped groups are not mapped again', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: {
        paceGroups: [[{ id: 'g1', name: 'Alpha', size: 20 }]],
        telegramChatTopics: [[{ paceGroupId: 'g1', messageThreadId: 11 }]],
        telegramObservedTopics: [
          [{ messageThreadId: 11, name: 'Alpha · 20 pages' }],
        ],
      },
    });
    const result = await matchPaceTopics(executor, BATCH_ID);
    expect(result).toEqual({ matched: [], attention: [], okCount: 1 });
    expect(executor.inserted).toEqual([]);
  });

  it('fails with NOT_CONNECTED when the batch has no chat', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [undefined] },
    });
    await expect(matchPaceTopics(executor, BATCH_ID)).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    });
  });
});

describe('renamePaceTopics', () => {
  it('renames drifted and wrong-pace topics to the canonical name and maps wrong-pace ones', async () => {
    const editForumTopic = vi.fn<TelegramApiPort['editForumTopic']>(
      async () => {},
    );
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: {
        paceGroups: [
          [
            { id: 'g1', name: 'Alpha', size: 20 },
            { id: 'g2', name: 'Beta', size: 10 },
            { id: 'g3', name: 'Gamma', size: 5 },
          ],
        ],
        telegramChatTopics: [[{ paceGroupId: 'g1', messageThreadId: 11 }]],
        telegramObservedTopics: [
          [
            { messageThreadId: 11, name: 'Alpha (old)' },
            { messageThreadId: 12, name: 'Beta · 20 pages' },
          ],
        ],
      },
    });

    const result = await renamePaceTopics(
      executor,
      makePort({ editForumTopic }),
      BATCH_ID,
    );

    expect(result).toEqual({
      renamed: ['Alpha · 20 pages', 'Beta · 10 pages'],
      failed: null,
    });
    expect(editForumTopic).toHaveBeenNthCalledWith(
      1,
      -1001234567890,
      11,
      'Alpha · 20 pages',
    );
    expect(editForumTopic).toHaveBeenNthCalledWith(
      2,
      -1001234567890,
      12,
      'Beta · 10 pages',
    );
    // names remembered as edited; only the wrong-pace topic gets a new mapping
    expect(executor.inserted).toEqual([
      expect.objectContaining({ messageThreadId: 11, nameSource: 'edited' }),
      expect.objectContaining({ messageThreadId: 12, nameSource: 'edited' }),
      expect.objectContaining({ paceGroupId: 'g2', messageThreadId: 12 }),
    ]);
  });

  it('stops at the first Telegram error', async () => {
    const editForumTopic = vi
      .fn<TelegramApiPort['editForumTopic']>()
      .mockRejectedValue({ description: 'Bad Request: TOPIC_NOT_MODIFIED' });
    const executor = makeFakeExecutor({
      first: { telegramChats: [readyChat] },
      many: {
        paceGroups: [[{ id: 'g1', name: 'Alpha', size: 20 }]],
        telegramChatTopics: [[{ paceGroupId: 'g1', messageThreadId: 11 }]],
        telegramObservedTopics: [[{ messageThreadId: 11, name: 'Other' }]],
      },
    });
    const result = await renamePaceTopics(
      executor,
      makePort({ editForumTopic }),
      BATCH_ID,
    );
    expect(result.renamed).toEqual([]);
    expect(result.failed).toEqual({
      name: 'Alpha · 20 pages',
      reason: 'Bad Request: TOPIC_NOT_MODIFIED',
    });
  });

  it('refuses when the bot cannot manage topics', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [{ ...readyChat, canManageTopics: false }] },
    });
    await expect(
      renamePaceTopics(executor, makePort(), BATCH_ID),
    ).rejects.toMatchObject({ code: 'TELEGRAM_API_ERROR' });
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
