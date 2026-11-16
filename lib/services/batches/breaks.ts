import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { batchBreaks, paceGroups } from '@/db/schema';
import type { CreateBatchBreakInput } from '@/lib/validations/batch-settings';

export type BatchBreakWithScope = {
  id: string;
  batchId: string;
  paceGroupId: string | null;
  paceGroupName: string;
  title: string;
  startDate: string;
  endDate: string;
  createdBy: string | null;
  createdAt: Date;
};

export async function listBatchBreaks(
  batchId: string,
  paceGroupId?: string | null,
): Promise<BatchBreakWithScope[]> {
  const whereCondition =
    paceGroupId && paceGroupId !== 'all'
      ? and(
          eq(batchBreaks.batchId, batchId),
          or(
            isNull(batchBreaks.paceGroupId),
            eq(batchBreaks.paceGroupId, paceGroupId),
          ),
        )
      : eq(batchBreaks.batchId, batchId);

  const rows = await db
    .select({
      id: batchBreaks.id,
      batchId: batchBreaks.batchId,
      paceGroupId: batchBreaks.paceGroupId,
      paceGroupName: paceGroups.name,
      title: batchBreaks.title,
      startDate: batchBreaks.startDate,
      endDate: batchBreaks.endDate,
      createdBy: batchBreaks.createdBy,
      createdAt: batchBreaks.createdAt,
    })
    .from(batchBreaks)
    .leftJoin(paceGroups, eq(paceGroups.id, batchBreaks.paceGroupId))
    .where(whereCondition)
    .orderBy(asc(batchBreaks.startDate));

  return rows.map((row) => ({
    ...row,
    paceGroupName: row.paceGroupId
      ? (row.paceGroupName ?? 'Specific group')
      : 'Whole batch',
  }));
}

export async function getBatchBreakById(breakId: string) {
  const [row] = await db
    .select()
    .from(batchBreaks)
    .where(eq(batchBreaks.id, breakId))
    .limit(1);

  return row ?? null;
}

export async function createBatchBreak(
  input: CreateBatchBreakInput,
  creatorProfileId?: string,
) {
  const [created] = await db
    .insert(batchBreaks)
    .values({
      batchId: input.batchId,
      paceGroupId: input.paceGroupId ?? null,
      title: input.title.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy: creatorProfileId ?? null,
    })
    .returning();

  return created;
}

export async function deleteBatchBreak(breakId: string, batchId: string) {
  const [deleted] = await db
    .delete(batchBreaks)
    .where(and(eq(batchBreaks.id, breakId), eq(batchBreaks.batchId, batchId)))
    .returning();

  return deleted ?? null;
}
