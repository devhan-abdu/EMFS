import { describe, expect, it } from 'vitest';
import {
  createLinkCode,
  generateLinkCode,
} from '../lib/services/telegram/link-codes';
import { TelegramConnectionError } from '../lib/services/telegram/errors';
import {
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  LINK_CODE_TTL_MINUTES,
} from '../lib/validations/telegram';
import { makeFakeExecutor } from './helpers/fake-executor';

const BATCH_ID = '3f2b8f0e-6a52-4a7e-9c55-0d1d9f6a1111';
const ACTOR_ID = '9a0c1e52-8b57-4e44-8d6a-2b6f0c7d2222';

describe('generateLinkCode', () => {
  it('produces codes of the right length from the safe alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLinkCode();
      expect(code).toHaveLength(LINK_CODE_LENGTH);
      for (const ch of code) expect(LINK_CODE_ALPHABET).toContain(ch);
    }
  });

  it('does not repeat across a sample', () => {
    const codes = new Set(Array.from({ length: 500 }, generateLinkCode));
    expect(codes.size).toBe(500);
  });
});

describe('createLinkCode', () => {
  it('rejects a malformed batch id before touching the db', async () => {
    const executor = makeFakeExecutor();
    await expect(createLinkCode(executor, 'nope', ACTOR_ID)).rejects.toThrow();
  });

  it('fails with BATCH_NOT_FOUND for an unknown batch', async () => {
    const executor = makeFakeExecutor({ first: { batches: [undefined] } });
    await expect(
      createLinkCode(executor, BATCH_ID, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'BATCH_NOT_FOUND' });
  });

  it('stores a code that expires after the configured TTL', async () => {
    const now = new Date('2026-10-18T10:00:00Z');
    const executor = makeFakeExecutor({
      first: { batches: [{ id: BATCH_ID }] },
      inserts: [[{ code: 'ABCD2345' }]],
    });

    await createLinkCode(executor, BATCH_ID, ACTOR_ID, now);

    expect(executor.inserted).toHaveLength(1);
    const values = executor.inserted[0] as {
      batchId: string;
      createdBy: string;
      expiresAt: Date;
      code: string;
    };
    expect(values.batchId).toBe(BATCH_ID);
    expect(values.createdBy).toBe(ACTOR_ID);
    expect(values.expiresAt.getTime() - now.getTime()).toBe(
      LINK_CODE_TTL_MINUTES * 60_000,
    );
    expect(values.code).toHaveLength(LINK_CODE_LENGTH);
  });

  it('throws a TelegramConnectionError instance', async () => {
    const executor = makeFakeExecutor({ first: { batches: [undefined] } });
    await expect(
      createLinkCode(executor, BATCH_ID, ACTOR_ID),
    ).rejects.toBeInstanceOf(TelegramConnectionError);
  });
});
