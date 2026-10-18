import { describe, expect, it, vi } from 'vitest';
import type { Context } from 'grammy';
import { isChatAdmin, isGroupChat } from '../lib/telegram/guards';

type FakeCtx = {
  chat?: { id: number; type: string };
  from?: { id: number };
  msg?: { sender_chat?: { id: number } };
  api: { getChatMember: ReturnType<typeof vi.fn> };
};

const asCtx = (ctx: FakeCtx) => ctx as unknown as Context;

describe('isChatAdmin', () => {
  it('accepts a creator or administrator', async () => {
    for (const status of ['creator', 'administrator']) {
      const getChatMember = vi.fn(async () => ({ status }));
      const ctx = asCtx({
        chat: { id: -100, type: 'supergroup' },
        from: { id: 5 },
        api: { getChatMember },
      });
      expect(await isChatAdmin(ctx)).toBe(true);
      expect(getChatMember).toHaveBeenCalledWith(-100, 5);
    }
  });

  it('rejects a regular member', async () => {
    const ctx = asCtx({
      chat: { id: -100, type: 'supergroup' },
      from: { id: 5 },
      api: { getChatMember: vi.fn(async () => ({ status: 'member' })) },
    });
    expect(await isChatAdmin(ctx)).toBe(false);
  });

  it('accepts an anonymous admin (sender_chat is the group itself)', async () => {
    const getChatMember = vi.fn();
    const ctx = asCtx({
      chat: { id: -100, type: 'supergroup' },
      from: { id: 1087968824 },
      msg: { sender_chat: { id: -100 } },
      api: { getChatMember },
    });
    expect(await isChatAdmin(ctx)).toBe(true);
    expect(getChatMember).not.toHaveBeenCalled();
  });

  it('rejects a post sent as another chat (e.g. a linked channel)', async () => {
    const ctx = asCtx({
      chat: { id: -100, type: 'supergroup' },
      from: { id: 777000 },
      msg: { sender_chat: { id: -200 } },
      api: { getChatMember: vi.fn() },
    });
    expect(await isChatAdmin(ctx)).toBe(false);
  });

  it('rejects when there is no chat or sender', async () => {
    expect(await isChatAdmin(asCtx({ api: { getChatMember: vi.fn() } }))).toBe(
      false,
    );
    expect(
      await isChatAdmin(
        asCtx({
          chat: { id: -100, type: 'supergroup' },
          api: { getChatMember: vi.fn() },
        }),
      ),
    ).toBe(false);
  });
});

describe('isGroupChat', () => {
  it('is true only for group and supergroup', () => {
    const api = { getChatMember: vi.fn() };
    expect(isGroupChat(asCtx({ chat: { id: -1, type: 'group' }, api }))).toBe(
      true,
    );
    expect(
      isGroupChat(asCtx({ chat: { id: -1, type: 'supergroup' }, api })),
    ).toBe(true);
    expect(isGroupChat(asCtx({ chat: { id: 1, type: 'private' }, api }))).toBe(
      false,
    );
    expect(isGroupChat(asCtx({ api }))).toBe(false);
  });
});
