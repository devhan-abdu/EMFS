import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Bot } from 'grammy';
import { TelegramConnectionError } from '../lib/services/telegram/errors';

const mocks = vi.hoisted(() => ({
  consumeLinkCode: vi.fn(),
  mapPaceTopic: vi.fn(),
  mapAnnouncementTopic: vi.fn(),
  unmapTopic: vi.fn(),
  applyBotMembershipChange: vi.fn(),
  migrateChatId: vi.fn(),
}));

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/services/telegram/connection', () => ({
  consumeLinkCode: mocks.consumeLinkCode,
  applyBotMembershipChange: mocks.applyBotMembershipChange,
  migrateChatId: mocks.migrateChatId,
}));
vi.mock('@/lib/services/telegram/topics', () => ({
  mapPaceTopic: mocks.mapPaceTopic,
  mapAnnouncementTopic: mocks.mapAnnouncementTopic,
  unmapTopic: mocks.unmapTopic,
}));

import { registerLinkHandler } from '../lib/telegram/handlers/link';
import { registerTopicHandler } from '../lib/telegram/handlers/topic';
import { registerChatEventHandlers } from '../lib/telegram/handlers/chat-events';

const CHAT = -1001234567890;
const BOT_ID = 123456;

function makeBot(adminIds: number[] = [5]) {
  const bot = new Bot('123456:TEST', {
    botInfo: {
      id: BOT_ID,
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
  const sent: string[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    const p = payload as Record<string, unknown>;
    if (method === 'getChat') {
      return {
        ok: true,
        result: { id: CHAT, type: 'supergroup', title: 'G', is_forum: true },
      } as never;
    }
    if (method === 'getChatMember') {
      const uid = p.user_id as number;
      const status =
        uid === BOT_ID || adminIds.includes(uid) ? 'administrator' : 'member';
      return {
        ok: true,
        result: {
          status,
          user: { id: uid, is_bot: false, first_name: 'U' },
          can_manage_topics: true,
        },
      } as never;
    }
    if (method === 'sendMessage') {
      sent.push(String(p.text));
      return {
        ok: true,
        result: {
          message_id: 1,
          date: 0,
          chat: { id: CHAT, type: 'supergroup' },
        },
      } as never;
    }
    return { ok: true, result: true } as never;
  });
  registerLinkHandler(bot);
  registerTopicHandler(bot);
  registerChatEventHandlers(bot);
  return { bot, sent };
}

let updateId = 0;
const command = (
  text: string,
  from: number,
  extra: Record<string, unknown> = {},
  chat: Record<string, unknown> = { id: CHAT, type: 'supergroup', title: 'G' },
) => ({
  update_id: ++updateId,
  message: {
    message_id: updateId,
    date: 0,
    chat,
    from: { id: from, is_bot: false, first_name: 'U' },
    text,
    entities: [
      { type: 'bot_command', offset: 0, length: text.split(' ')[0].length },
    ],
    ...extra,
  },
});
const inTopic = (thread: number) => ({
  message_thread_id: thread,
  is_topic_message: true,
});

describe('/link', () => {
  beforeEach(() => vi.resetAllMocks());

  it('refuses outside a group without touching the service', async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(
      command('/link ABCD2345', 5, {}, { id: 77, type: 'private' }) as never,
    );
    expect(sent[0]).toContain('inside the Telegram group');
    expect(mocks.consumeLinkCode).not.toHaveBeenCalled();
  });

  it('refuses non-admins without touching the service', async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(command('/link ABCD2345', 6) as never);
    expect(sent[0]).toBe('Only group admins can link this group.');
    expect(mocks.consumeLinkCode).not.toHaveBeenCalled();
  });

  it('shows usage for a malformed code', async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(command('/link nope', 5) as never);
    expect(sent[0]).toMatch(/^Usage: \/link CODE/);
    expect(mocks.consumeLinkCode).not.toHaveBeenCalled();
  });

  it('passes the verified chat facts to the service and confirms', async () => {
    mocks.consumeLinkCode.mockResolvedValue({
      chat: { canManageTopics: true },
      batchName: 'Batch 5',
    });
    const { bot, sent } = makeBot();
    await bot.handleUpdate(command('/link abcd2345', 5) as never);

    expect(mocks.consumeLinkCode).toHaveBeenCalledWith(
      {},
      {
        code: 'ABCD2345',
        chatId: BigInt(CHAT),
        title: 'G',
        isForum: true,
        canManageTopics: true,
      },
    );
    expect(sent[0]).toContain('Linked to Batch 5');
    expect(sent[0]).not.toContain('Manage topics');
  });

  it('shows the service error message to the admin', async () => {
    mocks.consumeLinkCode.mockRejectedValue(
      new TelegramConnectionError('NOT_A_FORUM', 'Topics are not enabled.'),
    );
    const { bot, sent } = makeBot();
    await bot.handleUpdate(command('/link ABCD2345', 5) as never);
    expect(sent[0]).toBe('❌ Topics are not enabled.');
  });

  it('hides unexpected errors behind a generic message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.consumeLinkCode.mockRejectedValue(new Error('connection refused'));
    const { bot, sent } = makeBot();
    await bot.handleUpdate(command('/link ABCD2345', 5) as never);
    expect(sent[0]).toBe('Something went wrong linking this group. Try again.');
    expect(sent[0]).not.toContain('connection refused');
  });
});

describe('/topic', () => {
  beforeEach(() => vi.resetAllMocks());

  it('refuses outside a topic (General has no thread)', async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(command('/topic pace Alpha', 5) as never);
    expect(sent[0]).toContain('inside a topic');
    expect(mocks.mapPaceTopic).not.toHaveBeenCalled();
  });

  it('refuses non-admins', async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(
      command('/topic pace Alpha', 6, inTopic(10)) as never,
    );
    expect(sent[0]).toBe('Only group admins can map topics.');
    expect(mocks.mapPaceTopic).not.toHaveBeenCalled();
  });

  it('maps a pace topic using the thread id Telegram sent', async () => {
    mocks.mapPaceTopic.mockResolvedValue({ paceGroupName: 'Alpha' });
    const { bot, sent } = makeBot();
    await bot.handleUpdate(
      command('/topic pace Alpha', 5, inTopic(10)) as never,
    );
    expect(mocks.mapPaceTopic).toHaveBeenCalledWith(
      {},
      { chatId: BigInt(CHAT), messageThreadId: 10, paceGroupName: 'Alpha' },
    );
    expect(sent[0]).toContain('topic for Alpha');
  });

  it('maps announcement and unmaps', async () => {
    mocks.unmapTopic.mockResolvedValue(true);
    const { bot, sent } = makeBot();
    await bot.handleUpdate(
      command('/topic announcement', 5, inTopic(12)) as never,
    );
    await bot.handleUpdate(command('/topic unmap', 5, inTopic(12)) as never);
    expect(mocks.mapAnnouncementTopic).toHaveBeenCalledWith(
      {},
      { chatId: BigInt(CHAT), messageThreadId: 12 },
    );
    expect(sent[1]).toBe('✅ Mapping removed.');
  });

  it('shows usage for an unknown subcommand', async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(command('/topic wat', 5, inTopic(10)) as never);
    expect(sent[0]).toMatch(/^Send this inside the topic/);
  });
});

describe('chat events', () => {
  beforeEach(() => vi.resetAllMocks());

  it('records the bot being removed from a supergroup', async () => {
    const { bot } = makeBot();
    await bot.handleUpdate({
      update_id: ++updateId,
      my_chat_member: {
        chat: { id: CHAT, type: 'supergroup', title: 'G' },
        from: { id: 5, is_bot: false, first_name: 'A' },
        date: 0,
        old_chat_member: {
          status: 'administrator',
          user: { id: BOT_ID, is_bot: true, first_name: 'T' },
        },
        new_chat_member: {
          status: 'kicked',
          user: { id: BOT_ID, is_bot: true, first_name: 'T' },
          until_date: 0,
        },
      },
    } as never);
    expect(mocks.applyBotMembershipChange).toHaveBeenCalledWith(
      {},
      BigInt(CHAT),
      { status: 'kicked', canManageTopics: false },
    );
  });

  it('ignores membership changes in private chats', async () => {
    const { bot } = makeBot();
    await bot.handleUpdate({
      update_id: ++updateId,
      my_chat_member: {
        chat: { id: 77, type: 'private', first_name: 'A' },
        from: { id: 77, is_bot: false, first_name: 'A' },
        date: 0,
        old_chat_member: {
          status: 'member',
          user: { id: BOT_ID, is_bot: true, first_name: 'T' },
        },
        new_chat_member: {
          status: 'kicked',
          user: { id: BOT_ID, is_bot: true, first_name: 'T' },
          until_date: 0,
        },
      },
    } as never);
    expect(mocks.applyBotMembershipChange).not.toHaveBeenCalled();
  });

  it('follows a group to its new supergroup id', async () => {
    const { bot } = makeBot();
    await bot.handleUpdate({
      update_id: ++updateId,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: -4000, type: 'group', title: 'G' },
        migrate_to_chat_id: CHAT,
      },
    } as never);
    expect(mocks.migrateChatId).toHaveBeenCalledWith(
      {},
      BigInt(-4000),
      BigInt(CHAT),
    );
  });
});
