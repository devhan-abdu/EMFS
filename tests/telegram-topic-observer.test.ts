import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Bot } from 'grammy';

const mocks = vi.hoisted(() => ({ recordObservedTopic: vi.fn() }));

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/services/telegram/observed-topics', () => ({
  recordObservedTopic: mocks.recordObservedTopic,
}));

import { registerTopicObserver } from '../lib/telegram/handlers/topic-observer';

const CHAT = -1001234567890;

function makeBot() {
  const bot = new Bot('123456:TEST', {
    botInfo: {
      id: 123456,
      is_bot: true,
      first_name: 'T',
      username: 'testbot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
    },
  });
  const reached: number[] = [];
  registerTopicObserver(bot);
  bot.on('message', (ctx) => {
    reached.push(ctx.message.message_id);
  });
  return { bot, reached };
}

const base = (extra: Record<string, unknown>) => ({
  update_id: 1,
  message: {
    message_id: 10,
    date: 1,
    chat: { id: CHAT, type: 'supergroup', title: 'G', is_forum: true },
    from: { id: 5, is_bot: false, first_name: 'A' },
    ...extra,
  },
});

describe('topic observer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.recordObservedTopic.mockResolvedValue(true);
  });

  it('records the name of a topic being created', async () => {
    const { bot } = makeBot();
    await bot.handleUpdate(
      base({
        message_thread_id: 77,
        is_topic_message: true,
        forum_topic_created: { name: 'Nur · 20 pages', icon_color: 1 },
      }) as never,
    );
    expect(mocks.recordObservedTopic).toHaveBeenCalledWith(
      {},
      {
        chatId: BigInt(CHAT),
        messageThreadId: 77,
        name: 'Nur · 20 pages',
        source: 'created',
      },
    );
  });

  it('records a rename', async () => {
    const { bot } = makeBot();
    await bot.handleUpdate(
      base({
        message_thread_id: 77,
        is_topic_message: true,
        forum_topic_edited: { name: 'Nur · 40 pages' },
      }) as never,
    );
    expect(mocks.recordObservedTopic).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ name: 'Nur · 40 pages', source: 'edited' }),
    );
  });

  it('reads the topic name from the root attached to an ordinary message', async () => {
    const { bot } = makeBot();
    await bot.handleUpdate(
      base({
        text: 'hello',
        message_thread_id: 77,
        is_topic_message: true,
        reply_to_message: {
          message_id: 77,
          date: 1,
          chat: { id: CHAT, type: 'supergroup' },
          forum_topic_created: { name: 'Nur · 20 pages', icon_color: 1 },
        },
      }) as never,
    );
    expect(mocks.recordObservedTopic).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        messageThreadId: 77,
        name: 'Nur · 20 pages',
        source: 'reply',
      }),
    );
  });

  it('ignores messages outside topics and in private chats', async () => {
    const { bot } = makeBot();
    await bot.handleUpdate(base({ text: 'hi' }) as never);
    await bot.handleUpdate({
      update_id: 2,
      message: {
        message_id: 11,
        date: 1,
        chat: { id: 5, type: 'private', first_name: 'A' },
        from: { id: 5, is_bot: false, first_name: 'A' },
        message_thread_id: 3,
        is_topic_message: true,
        forum_topic_created: { name: 'x', icon_color: 1 },
      },
    } as never);
    expect(mocks.recordObservedTopic).not.toHaveBeenCalled();
  });

  it('never blocks the next handler, even when recording fails', async () => {
    mocks.recordObservedTopic.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { bot, reached } = makeBot();
    await bot.handleUpdate(
      base({
        message_thread_id: 77,
        is_topic_message: true,
        forum_topic_created: { name: 'Nur · 20 pages', icon_color: 1 },
      }) as never,
    );
    expect(reached).toEqual([10]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
