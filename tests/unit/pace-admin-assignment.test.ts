import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/db', () => {
  return {
    db: {
      select: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

import { db } from '@/db';
import {
  assignPaceAdmin,
  removePaceAdminAssignment,
  PaceAdminError,
} from '@/lib/services/pace-groups/pace-admin-assignment';

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

const VALID_INPUT = {
  profileId: '33333333-3333-3333-3333-333333333333',
  paceGroupId: '44444444-4444-4444-4444-444444444444',
  duty: 'reflection' as const,
};

describe('Pace Admin Assignment Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws PACE_GROUP_NOT_FOUND when target pace group does not exist', async () => {
    vi.mocked(db.select).mockReturnValue(createSelectChain([]) as never);

    await expect(assignPaceAdmin(VALID_INPUT, 'actor-1')).rejects.toThrowError(
      PaceAdminError,
    );
  });

  it('throws PROFILE_NOT_FOUND when assigned user profile does not exist', async () => {
    vi.mocked(db.select).mockReturnValue(
      createSelectChain([{ id: 'group-1' }]) as never,
    );
    vi.mocked(db.transaction).mockImplementation((async (
      cb: (tx: unknown) => unknown,
    ) => {
      const tx = { select: () => createSelectChain([]) };
      return cb(tx);
    }) as never);

    try {
      await assignPaceAdmin(VALID_INPUT, 'actor-1');
    } catch (e) {
      expect(e).toBeInstanceOf(PaceAdminError);
      expect((e as PaceAdminError).code).toBe('PROFILE_NOT_FOUND');
    }
  });

  it('deletes assignment when record exists during removal', async () => {
    vi.mocked(db.select).mockReturnValue(
      createSelectChain([
        { id: 'assignment-1', paceGroupId: 'group-1' },
      ]) as never,
    );
    vi.mocked(db.delete).mockReturnValue({
      where: () => Promise.resolve(),
    } as never);

    const result = await removePaceAdminAssignment({
      assignmentId: '55555555-5555-5555-5555-555555555555',
    });

    expect(result.id).toBe('55555555-5555-5555-5555-555555555555');
  });
});
