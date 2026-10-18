import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bot } from 'grammy';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/telegram/bot', () => ({
  createBot: (token: string) =>
    new Bot(token, {
      botInfo: {
        id: 1,
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
    }),
}));

import { POST } from '../app/api/telegram/webhook/route';

const post = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ update_id: 1 }),
  });

describe('POST /api/telegram/webhook', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = '123456:TEST';
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'top-secret';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('fails closed (500) when the secret is not configured', async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    expect((await POST(post())).status).toBe(500);
  });

  it('fails closed (500) when the bot token is not configured', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect((await POST(post())).status).toBe(500);
  });

  it('rejects a request without the secret header', async () => {
    expect((await POST(post())).status).toBe(401);
  });

  it('rejects a request with the wrong secret header', async () => {
    const res = await POST(
      post({ 'x-telegram-bot-api-secret-token': 'wrong' }),
    );
    expect(res.status).toBe(401);
  });

  it('accepts a request with the correct secret header', async () => {
    const res = await POST(
      post({ 'x-telegram-bot-api-secret-token': 'top-secret' }),
    );
    expect(res.status).toBe(200);
  });
});
