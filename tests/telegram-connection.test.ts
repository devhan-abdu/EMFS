import { describe, expect, it } from 'vitest';
import {
  applyBotMembershipChange,
  consumeLinkCode,
  disconnect,
  getConnection,
  syncChatInfo,
} from '../lib/services/telegram/connection';
import type { TelegramApiPort } from '../lib/services/telegram/api-port';
import { makeFakeExecutor } from './helpers/fake-executor';

const BATCH_ID = '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111';
const CHAT_ROW_ID = '7c1d2e3f-0000-4000-8000-000000000001';
const CHAT_ID = BigInt('-1001234567890');

const baseInput = {
  code: 'ABCD2345',
  chatId: CHAT_ID,
  title: 'Batch 5',
  isForum: true,
  canManageTopics: true,
};

const usedCode = { batchId: BATCH_ID, createdBy: 'actor-1' };

describe('consumeLinkCode', () => {
  it('fails when the code is unknown, expired or already used', async () => {
    const executor = makeFakeExecutor({ updates: [[]] });
    await expect(consumeLinkCode(executor, baseInput)).rejects.toMatchObject({
      code: 'INVALID_OR_EXPIRED_CODE',
    });
  });

  it('rejects a chat that is already linked', async () => {
    const executor = makeFakeExecutor({
      updates: [[usedCode]],
      first: {
        batches: [{ id: BATCH_ID, name: 'Batch 5' }],
        telegramChats: [{ id: CHAT_ROW_ID }],
      },
    });
    await expect(consumeLinkCode(executor, baseInput)).rejects.toMatchObject({
      code: 'CHAT_ALREADY_LINKED',
    });
  });

  it('rejects a batch that already has a group', async () => {
    const executor = makeFakeExecutor({
      updates: [[usedCode]],
      first: {
        batches: [{ id: BATCH_ID, name: 'Batch 5' }],
        telegramChats: [undefined, { id: CHAT_ROW_ID }],
      },
    });
    await expect(consumeLinkCode(executor, baseInput)).rejects.toMatchObject({
      code: 'BATCH_ALREADY_LINKED',
    });
  });

  it('rejects a group without Topics enabled', async () => {
    const executor = makeFakeExecutor({
      updates: [[usedCode]],
      first: {
        batches: [{ id: BATCH_ID, name: 'Batch 5' }],
        telegramChats: [undefined, undefined],
      },
    });
    await expect(
      consumeLinkCode(executor, { ...baseInput, isForum: false }),
    ).rejects.toMatchObject({ code: 'NOT_A_FORUM' });
  });

  it('rejects a positive (non-group) chat id before touching the db', async () => {
    const executor = makeFakeExecutor();
    await expect(
      consumeLinkCode(executor, { ...baseInput, chatId: BigInt(42) }),
    ).rejects.toThrow();
  });

  it('links the chat to the code batch and returns the batch name', async () => {
    const executor = makeFakeExecutor({
      updates: [[usedCode]],
      first: {
        batches: [{ id: BATCH_ID, name: 'Batch 5' }],
        telegramChats: [undefined, undefined],
      },
      inserts: [[{ id: CHAT_ROW_ID, batchId: BATCH_ID, chatId: CHAT_ID }]],
    });

    const result = await consumeLinkCode(executor, baseInput);

    expect(result.batchName).toBe('Batch 5');
    expect(executor.inserted[0]).toMatchObject({
      chatId: CHAT_ID,
      batchId: BATCH_ID,
      isForum: true,
      linkedBy: 'actor-1',
    });
  });
});

describe('getConnection', () => {
  it('returns not connected with the active code when there is no chat', async () => {
    const expiresAt = new Date('2026-10-18T10:15:00Z');
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [undefined],
        telegramLinkCodes: [{ code: 'ABCD2345', expiresAt }],
      },
    });

    const view = await getConnection(
      executor,
      BATCH_ID,
      new Date('2026-10-18T10:00:00Z'),
    );

    expect(view).toEqual({
      connected: false,
      activeCode: { code: 'ABCD2345', expiresAt, minutesLeft: 15 },
    });
  });

  it('maps pace groups to their topic threads and never exposes the chat id', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [
          {
            id: CHAT_ROW_ID,
            chatId: CHAT_ID,
            title: 'Batch 5',
            isForum: true,
            status: 'active',
            canManageTopics: true,
            linkedAt: new Date('2026-10-18T09:00:00Z'),
          },
        ],
      },
      many: {
        paceGroups: [
          [
            { id: 'g1', name: 'Alpha', size: 20 },
            { id: 'g2', name: 'Beta', size: 10 },
          ],
        ],
        telegramChatTopics: [
          [
            { kind: 'pace_group', paceGroupId: 'g1', messageThreadId: 11 },
            { kind: 'announcement', paceGroupId: null, messageThreadId: 5 },
          ],
        ],
        telegramObservedTopics: [
          [{ messageThreadId: 11, name: 'Alpha · 20 pages' }],
        ],
      },
    });

    const view = await getConnection(executor, BATCH_ID);

    expect(view.connected).toBe(true);
    if (!view.connected) return;
    expect(view.paceGroups).toEqual([
      {
        id: 'g1',
        name: 'Alpha',
        expectedName: 'Alpha · 20 pages',
        status: 'mapped',
        messageThreadId: 11,
        observedName: 'Alpha · 20 pages',
        hint: null,
      },
      {
        id: 'g2',
        name: 'Beta',
        expectedName: 'Beta · 10 pages',
        status: 'missing',
        messageThreadId: null,
        observedName: null,
        hint: expect.stringContaining('"Beta · 10 pages"'),
      },
    ]);
    expect(view.announcementThreadId).toBe(5);
    expect(
      JSON.stringify(view, (_, v) => (typeof v === 'bigint' ? 'big' : v)),
    ).not.toContain('1001234567890');
    expect('chatId' in view.chat).toBe(false);
  });
});

describe('disconnect', () => {
  it('reports whether a link was removed', async () => {
    expect(
      await disconnect(
        makeFakeExecutor({ deletes: [[{ id: 'x' }]] }),
        BATCH_ID,
      ),
    ).toBe(true);
    expect(
      await disconnect(makeFakeExecutor({ deletes: [[]] }), BATCH_ID),
    ).toBe(false);
  });
});

describe('applyBotMembershipChange', () => {
  it('marks the chat bot_removed when the bot left', async () => {
    const executor = makeFakeExecutor();
    await applyBotMembershipChange(executor, CHAT_ID, {
      status: 'kicked',
      canManageTopics: false,
    });
    expect(executor.update).toHaveBeenCalledTimes(1);
  });
});

describe('syncChatInfo', () => {
  const port = (overrides: Partial<TelegramApiPort> = {}): TelegramApiPort => ({
    getMe: async () => ({ id: 99 }),
    getChat: async () => ({ title: 'Renamed', isForum: true }),
    getChatMember: async () => ({
      status: 'administrator',
      canManageTopics: true,
    }),
    createForumTopic: async () => ({ messageThreadId: 1 }),
    sendMessage: async () => {},
    ...overrides,
  });

  it('fails with NOT_CONNECTED when the batch has no chat', async () => {
    const executor = makeFakeExecutor({
      first: { telegramChats: [undefined] },
    });
    await expect(
      syncChatInfo(executor, port(), BATCH_ID),
    ).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('marks the chat bot_removed and reports a Telegram error when unreachable', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [{ id: CHAT_ROW_ID, chatId: CHAT_ID, title: 'x' }],
      },
    });
    await expect(
      syncChatInfo(
        executor,
        port({
          getChat: async () => {
            throw { description: 'Bad Request: chat not found' };
          },
        }),
        BATCH_ID,
      ),
    ).rejects.toMatchObject({ code: 'TELEGRAM_API_ERROR' });
    expect(executor.update).toHaveBeenCalledTimes(1);
  });

  it('refreshes title, topics flag and rights from Telegram', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [{ id: CHAT_ROW_ID, chatId: CHAT_ID, title: 'old' }],
      },
    });
    await syncChatInfo(executor, port(), BATCH_ID);
    expect(executor.update).toHaveBeenCalledTimes(1);
  });
});
