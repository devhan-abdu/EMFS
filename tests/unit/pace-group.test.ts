import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/db', () => {
  return {
    db: {
      select: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

import { db } from '@/db';
import {
  createPaceGroup,
  updatePaceGroup,
  archivePaceGroup,
  PaceGroupError,
} from '@/lib/services/pace-groups/pace-group';

function createSelectChain(result: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(result),
      }),
      orderBy: () => Promise.resolve(result),
    }),
  };
}

describe('Pace Group Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws BATCH_NOT_FOUND when target batch does not exist', async () => {
    vi.mocked(db.transaction).mockImplementation((async (
      cb: (tx: unknown) => unknown,
    ) => {
      const tx = { select: () => createSelectChain([]) };
      return cb(tx);
    }) as never);

    await expect(
      createPaceGroup({
        batchId: '11111111-1111-1111-1111-111111111111',
        name: 'Group Alpha',
        min_pages: 10,
        max_pages: 10,
        overridePlannedCount: false,
      }),
    ).rejects.toThrowError(PaceGroupError);
  });

  it('rejects a case-insensitive duplicate pace-group name in the same batch', async () => {
    const batchId = '11111111-1111-1111-1111-111111111111';
    const selectResults = [
      [{ id: batchId, paceGroupCount: 3 }],
      [{ id: '33333333-3333-3333-3333-333333333333' }],
    ];
    const select = vi.fn(() => createSelectChain(selectResults.shift() ?? []));

    vi.mocked(db.transaction).mockImplementation((async (
      cb: (tx: unknown) => unknown,
    ) => cb({ select })) as never);

    await expect(
      createPaceGroup({
        batchId,
        name: 'group alpha',
        min_pages: 10,
        max_pages: 10,
        overridePlannedCount: false,
      }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_NAME',
      message:
        'A pace group with this name already exists in this batch. Please choose a different name.',
    });

    expect(select).toHaveBeenCalledTimes(2);
  });

  it('rejects a case-insensitive duplicate name when updating a pace group', async () => {
    const paceGroupId = '22222222-2222-2222-2222-222222222222';
    const existing = {
      id: paceGroupId,
      batchId: '11111111-1111-1111-1111-111111111111',
      name: 'Group Alpha',
      min_pages: 10,
      max_pages: 10,
      activeCatalogSlotId: '44444444-4444-4444-4444-444444444444',
      archived: false,
    };
    vi.mocked(db.select)
      .mockReturnValueOnce(createSelectChain([existing]) as never)
      .mockReturnValueOnce(
        createSelectChain([
          { id: '33333333-3333-3333-3333-333333333333' },
        ]) as never,
      );

    await expect(
      updatePaceGroup({ paceGroupId, name: 'group beta' }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_NAME',
      message:
        'A pace group with this name already exists in this batch. Please choose a different name.',
    });

    expect(db.update).not.toHaveBeenCalled();
  });

  it('throws PACE_GROUP_NOT_FOUND when archiving non-existent group', async () => {
    vi.mocked(db.select).mockReturnValue(createSelectChain([]) as never);

    await expect(
      archivePaceGroup({ paceGroupId: '22222222-2222-2222-2222-222222222222' }),
    ).rejects.toThrowError('Pace group not found.');
  });
});
