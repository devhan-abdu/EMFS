import { describe, expect, it } from 'vitest';

import {
  createPaceGroupForDiscoveredTopic,
  mapDiscoveredTopic,
  registerDiscoveredTopic,
  TelegramTopicDiscoveryError,
} from '../lib/services/telegram/topic-discovery';
import { PaceGroupError } from '../lib/services/pace-groups/pace-group';
import { makeFakeExecutor } from './helpers/fake-executor';

const BATCH_ID = '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111';
const CHAT_ROW_ID = '7c1d2e3f-0000-4000-8000-000000000001';
const DISCOVERY_ID = '4f2b8f0e-6a52-4a7e-9c55-0d1d9f6a2222';
const PACE_GROUP_ID = '5f2b8f0e-6a52-4a7e-9c55-0d1d9f6a3333';

describe('mapDiscoveredTopic', () => {
  it('maps a registered existing topic to a pace group without creating a Telegram topic', async () => {
    const executor = makeFakeExecutor({
      first: {
        batches: [{ id: BATCH_ID, telegramTopicSyncMode: 'manual' }],
        telegramChats: [{ id: CHAT_ROW_ID, status: 'active' }],
        paceGroups: [{ id: PACE_GROUP_ID }],
        telegramTopicDiscoveries: [
          {
            id: DISCOVERY_ID,
            messageThreadId: 12,
            topicName: 'Existing Reading Group',
          },
        ],
      },
      selects: [[], []],
      inserts: [[{ id: 'mapping-1' }]],
    });

    const result = await mapDiscoveredTopic(executor, {
      batchId: BATCH_ID,
      discoveryId: DISCOVERY_ID,
      paceGroupId: PACE_GROUP_ID,
    });

    expect(result.message).toBe('Telegram topic mapped to the pace group.');
    expect(executor.inserted).toEqual([
      {
        telegramChatId: CHAT_ROW_ID,
        messageThreadId: 12,
        kind: 'pace_group',
        paceGroupId: PACE_GROUP_ID,
        name: 'Existing Reading Group',
      },
    ]);
  });

  it('does not map topics for a managed batch', async () => {
    const executor = makeFakeExecutor({
      first: {
        batches: [{ id: BATCH_ID, telegramTopicSyncMode: 'managed' }],
      },
    });

    await expect(
      mapDiscoveredTopic(executor, {
        batchId: BATCH_ID,
        discoveryId: DISCOVERY_ID,
        paceGroupId: PACE_GROUP_ID,
      }),
    ).rejects.toBeInstanceOf(TelegramTopicDiscoveryError);
    expect(executor.inserted).toEqual([]);
  });
});

describe('registerDiscoveredTopic', () => {
  it('trims and saves the admin-provided title with the Telegram thread ID', async () => {
    const executor = makeFakeExecutor({
      first: {
        telegramChats: [
          { id: CHAT_ROW_ID, batchId: BATCH_ID, status: 'active' },
        ],
        batches: [{ id: BATCH_ID, telegramTopicSyncMode: 'manual' }],
      },
      inserts: [[{ id: DISCOVERY_ID }]],
    });

    const result = await registerDiscoveredTopic(executor, {
      chatId: BigInt('-1001234567890'),
      messageThreadId: 12,
      topicName: '  Existing Reading Group  ',
    });

    expect(result.registered).toBe(true);
    expect(executor.inserted).toEqual([
      {
        telegramChatId: CHAT_ROW_ID,
        messageThreadId: 12,
        topicName: 'Existing Reading Group',
      },
    ]);
  });
});

describe('createPaceGroupForDiscoveredTopic', () => {
  it('creates a pace group, maps the existing topic, and consumes its discovery', async () => {
    const executor = makeFakeExecutor({
      first: {
        batches: [{ id: BATCH_ID, telegramTopicSyncMode: 'manual' }],
        telegramChats: [{ id: CHAT_ROW_ID, status: 'active' }],
        telegramTopicDiscoveries: [
          {
            id: DISCOVERY_ID,
            messageThreadId: 12,
            topicName: 'Existing Reading Group',
          },
        ],
      },
      selects: [
        [],
        [{ id: BATCH_ID, paceGroupCount: 3 }],
        [{ id: 'initial-slot' }],
        [{ id: 'initial-book' }],
        [{ existingCount: 1 }],
      ],
      inserts: [
        [
          {
            id: PACE_GROUP_ID,
            batchId: BATCH_ID,
            name: 'Reading 10',
            size: 10,
            archived: false,
          },
        ],
        [{ id: 'topic-mapping' }],
      ],
    });

    const result = await createPaceGroupForDiscoveredTopic(executor, {
      batchId: BATCH_ID,
      discoveryId: DISCOVERY_ID,
      name: 'Reading 10',
      size: 10,
    });

    expect(result.paceGroup).toMatchObject({
      id: PACE_GROUP_ID,
      batchId: BATCH_ID,
      name: 'Reading 10',
      size: 10,
    });
    expect(executor.inserted).toContainEqual({
      telegramChatId: CHAT_ROW_ID,
      messageThreadId: 12,
      kind: 'pace_group',
      paceGroupId: PACE_GROUP_ID,
      name: 'Existing Reading Group',
    });
  });

  it('does not create partial records when the planned pace-group count is exhausted', async () => {
    const executor = makeFakeExecutor({
      first: {
        batches: [{ id: BATCH_ID, telegramTopicSyncMode: 'manual' }],
        telegramChats: [{ id: CHAT_ROW_ID, status: 'active' }],
        telegramTopicDiscoveries: [
          {
            id: DISCOVERY_ID,
            messageThreadId: 12,
            topicName: 'Existing Reading Group',
          },
        ],
      },
      selects: [
        [],
        [{ id: BATCH_ID, paceGroupCount: 1 }],
        [{ id: 'initial-slot' }],
        [{ id: 'initial-book' }],
        [{ existingCount: 1 }],
      ],
    });

    await expect(
      createPaceGroupForDiscoveredTopic(executor, {
        batchId: BATCH_ID,
        discoveryId: DISCOVERY_ID,
        name: 'Reading 10',
        size: 10,
      }),
    ).rejects.toBeInstanceOf(PaceGroupError);
    expect(executor.inserted).toEqual([]);
  });
});
