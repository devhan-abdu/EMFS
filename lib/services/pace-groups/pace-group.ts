import { and, asc, count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { books, catalogSlots, paceGroups, batches } from '@/db/schema';
import type {
  CreatePaceGroupInput,
  UpdatePaceGroupInput,
  ArchivePaceGroupInput,
  ListPaceGroupsInput,
} from '@/lib/validations/pace-group';

export type PaceGroupErrorCode =
  | 'BATCH_NOT_FOUND'
  | 'PACE_GROUP_NOT_FOUND'
  | 'PLANNED_COUNT_EXCEEDED'
  | 'CATALOG_NOT_CONFIGURED'
  | 'ALREADY_ARCHIVED';

export class PaceGroupError extends Error {
  code: PaceGroupErrorCode;
  constructor(code: PaceGroupErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PaceGroupError';
  }
}

export type PaceGroupRow = {
  id: string;
  batchId: string;
  name: string;
  max_pages: number;
  archived: boolean;
};

const PACE_GROUP_RETURNING = {
  id: paceGroups.id,
  batchId: paceGroups.batchId,
  name: paceGroups.name,
  max_pages: paceGroups.max_pages,
  archived: paceGroups.archived,
};

export async function getPaceGroupById(paceGroupId: string) {
  const [existing] = await db
    .select()
    .from(paceGroups)
    .where(eq(paceGroups.id, paceGroupId))
    .limit(1);
  return existing ?? null;
}

export async function createPaceGroup(
  input: CreatePaceGroupInput,
): Promise<PaceGroupRow> {
  const { batchId, name, max_pages, overridePlannedCount } = input;

  return db.transaction(async (tx) => {
    const [batch] = await tx
      .select({ id: batches.id, paceGroupCount: batches.paceGroupCount })
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new PaceGroupError('BATCH_NOT_FOUND', 'Batch not found.');
    }

    const [initialSlot] = await tx
      .select({ id: catalogSlots.id })
      .from(catalogSlots)
      .where(eq(catalogSlots.sequenceOrder, 1))
      .limit(1);

    if (!initialSlot) {
      throw new PaceGroupError(
        'CATALOG_NOT_CONFIGURED',
        'Add a catalog slot 1 before creating pace groups.',
      );
    }

    const [initialBook] = await tx
      .select({ id: books.id })
      .from(books)
      .where(
        and(eq(books.catalogSlotId, initialSlot.id), eq(books.language, 'en')),
      )
      .orderBy(asc(books.language))
      .limit(1);

    if (!initialBook) {
      throw new PaceGroupError(
        'CATALOG_NOT_CONFIGURED',
        'Add an English book to catalog slot 1 before creating pace groups.',
      );
    }

    if (!overridePlannedCount) {
      const [{ existingCount }] = await tx
        .select({ existingCount: count() })
        .from(paceGroups)
        .where(
          and(eq(paceGroups.batchId, batchId), eq(paceGroups.archived, false)),
        );

      if (Number(existingCount) >= batch.paceGroupCount) {
        throw new PaceGroupError(
          'PLANNED_COUNT_EXCEEDED',
          `This batch planned for ${batch.paceGroupCount} pace group(s). Pass overridePlannedCount to add more.`,
        );
      }
    }

    const [created] = await tx
      .insert(paceGroups)
      .values({ batchId, name, max_pages, activeCatalogSlotId: initialSlot.id })
      .returning(PACE_GROUP_RETURNING);

    return created;
  });
}

export async function updatePaceGroup(
  input: UpdatePaceGroupInput,
): Promise<PaceGroupRow> {
  const { paceGroupId, name, max_pages } = input;

  const existing = await getPaceGroupById(paceGroupId);
  if (!existing) {
    throw new PaceGroupError('PACE_GROUP_NOT_FOUND', 'Pace group not found.');
  }

  const [updated] = await db
    .update(paceGroups)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(max_pages !== undefined ? { max_pages } : {}),
      updatedAt: new Date(),
    })
    .where(eq(paceGroups.id, paceGroupId))
    .returning(PACE_GROUP_RETURNING);

  return updated;
}

export async function archivePaceGroup(
  input: ArchivePaceGroupInput,
): Promise<PaceGroupRow> {
  const { paceGroupId } = input;

  const existing = await getPaceGroupById(paceGroupId);
  if (!existing) {
    throw new PaceGroupError('PACE_GROUP_NOT_FOUND', 'Pace group not found.');
  }

  if (existing.archived) {
    throw new PaceGroupError(
      'ALREADY_ARCHIVED',
      'Pace group is already archived.',
    );
  }

  const [updated] = await db
    .update(paceGroups)
    .set({ archived: true, archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(paceGroups.id, paceGroupId))
    .returning(PACE_GROUP_RETURNING);

  return updated;
}

export async function listPaceGroupsForBatch(
  input: ListPaceGroupsInput,
): Promise<PaceGroupRow[]> {
  const { batchId, includeArchived } = input;

  return db
    .select(PACE_GROUP_RETURNING)
    .from(paceGroups)
    .where(
      includeArchived
        ? eq(paceGroups.batchId, batchId)
        : and(eq(paceGroups.batchId, batchId), eq(paceGroups.archived, false)),
    )
    .orderBy(asc(paceGroups.createdAt));
}
