import { randomInt } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import { batches, telegramChats, telegramLinkCodes } from '@/db/schema';
import type { DbOrTx } from '@/lib/services/membership';
import { db } from '@/db';
import {
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  LINK_CODE_TTL_MINUTES,
  LinkMode,
  batchIdSchema,
} from '@/lib/validations/telegram';
import { TelegramConnectionError } from './errors';

export function generateLinkCode(): string {
  let code = '';

  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  }

  return code;
}

export async function createLinkCode(
  executor: DbOrTx,
  batchId: string,
  actorProfileId: string,
  now: Date = new Date(),
) {
  batchIdSchema.parse(batchId);

  const create = async (tx: DbOrTx) => {
    const [batch] = await tx
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, batchId))
      .for('update');

    if (!batch) {
      throw new TelegramConnectionError('BATCH_NOT_FOUND', 'Batch not found.');
    }

    // 2. Block only when the bot is really in a group.
    //    A 'bot_removed' row doesn't block, so the admin can reconnect.
    const [existing] = await tx
      .select({ status: telegramChats.status })
      .from(telegramChats)
      .where(eq(telegramChats.batchId, batchId))
      .limit(1);

    if (existing?.status === 'active') {
      throw new TelegramConnectionError(
        'BATCH_ALREADY_LINKED',
        'This batch is already connected to a Telegram group.',
      );
    }

    const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MINUTES * 60_000);

    const [active] = await tx
      .update(telegramLinkCodes)
      .set({ expiresAt, createdBy: actorProfileId })
      .where(
        and(
          eq(telegramLinkCodes.batchId, batchId),
          isNull(telegramLinkCodes.usedAt),
          gt(telegramLinkCodes.expiresAt, now),
        ),
      )
      .returning({
        code: telegramLinkCodes.code,
        expiresAt: telegramLinkCodes.expiresAt,
      });

    if (active) return active;

    for (let attempt = 0; attempt < 3; attempt++) {
      const [row] = await tx
        .insert(telegramLinkCodes)
        .values({
          code: generateLinkCode(),
          batchId,
          createdBy: actorProfileId,
          expiresAt,
        })
        .onConflictDoNothing({
          target: telegramLinkCodes.code,
        })
        .returning({
          code: telegramLinkCodes.code,
          expiresAt: telegramLinkCodes.expiresAt,
        });

      if (row) return row;
    }

    throw new Error('Could not generate a unique link code.');
  };

  // Reuse an existing transaction.
  if (executor !== db) {
    return create(executor);
  }

  return db.transaction(create);
}

/** The currently valid code for a batch, if any. */
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
