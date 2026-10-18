import { randomInt } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { batches, telegramLinkCodes } from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import {
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  LINK_CODE_TTL_MINUTES,
  batchIdSchema,
} from '@/lib/validations/telegram';
import { TelegramConnectionError, isUniqueViolation } from './errors';

export function generateLinkCode(): string {
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Issues a single-use code that binds one Telegram group to this batch.
 * Older unused codes for the batch are expired so only one is ever valid.
 * `actorProfileId` must come from the session, never from client input.
 */
export async function createLinkCode(
  executor: DbOrTx,
  batchId: string,
  actorProfileId: string,
  now: Date = new Date(),
) {
  batchIdSchema.parse(batchId);

  const batch = await executor.query.batches.findFirst({
    where: eq(batches.id, batchId),
    columns: { id: true },
  });
  if (!batch) {
    throw new TelegramConnectionError('BATCH_NOT_FOUND', 'Batch not found.');
  }

  await executor
    .update(telegramLinkCodes)
    .set({ expiresAt: now })
    .where(
      and(
        eq(telegramLinkCodes.batchId, batchId),
        isNull(telegramLinkCodes.usedAt),
        gt(telegramLinkCodes.expiresAt, now),
      ),
    );

  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MINUTES * 60_000);

  // A collision on a 31^8 code space is practically impossible; retry anyway.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await executor
        .insert(telegramLinkCodes)
        .values({
          code: generateLinkCode(),
          batchId,
          createdBy: actorProfileId,
          expiresAt,
        })
        .returning();
      return row;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error('Could not generate a unique link code.');
}

/** The currently valid code for a batch, if any (so the page survives a reload). */
export async function findActiveLinkCode(
  executor: DbOrTx,
  batchId: string,
  now: Date = new Date(),
) {
  const row = await executor.query.telegramLinkCodes.findFirst({
    where: and(
      eq(telegramLinkCodes.batchId, batchId),
      isNull(telegramLinkCodes.usedAt),
      gt(telegramLinkCodes.expiresAt, now),
    ),
    orderBy: desc(telegramLinkCodes.createdAt),
  });
  return row ?? null;
}
