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
        size: 10,
        overridePlannedCount: false,
      }),
    ).rejects.toThrowError(PaceGroupError);
  });

  it('throws PACE_GROUP_NOT_FOUND when archiving non-existent group', async () => {
    vi.mocked(db.select).mockReturnValue(createSelectChain([]) as never);

    await expect(
      archivePaceGroup({ paceGroupId: '22222222-2222-2222-2222-222222222222' }),
    ).rejects.toThrowError('Pace group not found.');
  });
});
