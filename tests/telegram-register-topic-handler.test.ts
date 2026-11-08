import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Bot } from 'grammy';

const mocks = vi.hoisted(() => ({
  registerDiscoveredTopic: vi.fn(),
  isChatAdmin: vi.fn(),
  isGroupChat: vi.fn(),
}));

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/services/telegram/topic-discovery', () => ({
  registerDiscoveredTopic: mocks.registerDiscoveredTopic,
  TelegramTopicDiscoveryError: class TelegramTopicDiscoveryError extends Error {},
}));
vi.mock('@/lib/telegram/guards', () => ({
  isChatAdmin: mocks.isChatAdmin,
  isGroupChat: mocks.isGroupChat,
}));

import { registerTopicHandler } from '../lib/telegram/handlers/register-topic';

const CHAT_ID = -1001234567890;
const THREAD_ID = 24;
let updateId = 0;

function makeHandlerBot() {
  const bot = new Bot('123456:TEST', {
    botInfo: {
      id: 123456,
      is_bot: true,
      first_name: 'EMFS',
      username: 'emfs_test_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: true,
      allows_users_to_create_topics: false,
    },
  });
  const replies: string[] = [];

  bot.api.config.use(async (_previous, method, payload) => {
    if (method === 'sendMessage') {
      replies.push(String((payload as { text?: string }).text));
      return {
        ok: true,
        result: {
          message_id: 1,
          date: 0,
          chat: { id: CHAT_ID, type: 'supergroup' },
        },
      } as never;
    }

    return { ok: true, result: true } as never;
  });

  registerTopicHandler(bot);
  return { bot, replies };
}

function topicCommand(text: string, threadId?: number) {
  return {
    update_id: ++updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: CHAT_ID, type: 'supergroup', title: 'Reading group' },
      from: { id: 10, is_bot: false, first_name: 'Admin' },
      text,
      entities: [
        {
          type: 'bot_command',
          offset: 0,
          length: text.split(' ')[0].length,
        },
      ],
      ...(threadId === undefined
        ? {}
        : { message_thread_id: threadId, is_topic_message: true }),
    },
  };
}

describe('/register_topic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isChatAdmin.mockResolvedValue(true);
    mocks.isGroupChat.mockReturnValue(true);
    mocks.registerDiscoveredTopic.mockResolvedValue({
      registered: true,
      discoveryId: '4f2b8f0e-6a52-4a7e-9c55-0d1d9f6a2222',
      message: 'Topic registered successfully.',
    });
  });

  it('registers the topic title and thread ID for an admin', async () => {
    const { bot, replies } = makeHandlerBot();

    await bot.handleUpdate(
      topicCommand('/register_topic Early Readers', THREAD_ID) as never,
    );

    expect(mocks.registerDiscoveredTopic).toHaveBeenCalledWith(
      {},
      {
        chatId: BigInt(CHAT_ID),
        messageThreadId: THREAD_ID,
        topicName: 'Early Readers',
      },
    );
    expect(replies[0]).toContain('Early Readers');
  });

  it('requires a title and an existing forum topic', async () => {
    const { bot, replies } = makeHandlerBot();

    await bot.handleUpdate(topicCommand('/register_topic', THREAD_ID) as never);
    await bot.handleUpdate(
      topicCommand('/register_topic Early Readers') as never,
    );

    expect(mocks.registerDiscoveredTopic).not.toHaveBeenCalled();
    expect(replies[0]).toContain('Usage: /register_topic <topic name>');
    expect(replies[1]).toContain('inside the topic');
  });

  it('rejects non-admin users before registering a topic', async () => {
    mocks.isChatAdmin.mockResolvedValue(false);
    const { bot, replies } = makeHandlerBot();

    await bot.handleUpdate(
      topicCommand('/register_topic Early Readers', THREAD_ID) as never,
    );

    expect(mocks.registerDiscoveredTopic).not.toHaveBeenCalled();
    expect(replies[0]).toContain('Only a group administrator');
  });

  it('rejects topic names longer than Telegram allows', async () => {
    const { bot } = makeHandlerBot();

    await bot.handleUpdate(
      topicCommand(`/register_topic ${'x'.repeat(129)}`, THREAD_ID) as never,
    );

    expect(mocks.registerDiscoveredTopic).not.toHaveBeenCalled();
  });
});
