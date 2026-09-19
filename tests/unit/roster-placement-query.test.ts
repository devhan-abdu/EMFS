import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/db', () => {
  return {
    db: {
      select: vi.fn(),
      query: {
        batches: {
          findFirst: vi.fn(),
        },
      },
      transaction: vi.fn(),
    },
  };
});

import {
  getBatchRoster,
  getBatchPlacementStats,
  PlacementError,
} from '@/lib/services/pace-groups/placement';

const MOCK_BATCH_ID = '11111111-1111-1111-1111-111111111111';

const MOCK_BATCH = {
  id: MOCK_BATCH_ID,
  name: 'Batch 5 � Ramadan',
};

const MOCK_RAW_ROWS = [
  {
    profileId: 'p1',
    authUserId: 'u1',
    firstName: 'Hanan',
    fatherName: 'Ibrahim',
    grandfatherName: 'Ali',
    userName: 'Hanan Ibrahim',
    userEmail: 'hanan@example.com',
    profileTelegram: 'hanan_ibrahim',
    profilePhone: '+251911111111',
    appEmail: 'hanan@example.com',
    appTelegram: 'hanan_ibrahim',
    appPhone: '+251911111111',
    appPacePreference: '10',
    membershipId: 'bm1',
    batchMembershipStatus: 'active',
    enrolledAt: new Date('2026-01-01'),
    paceGroupMembershipId: 'pgm1',
    paceGroupId: 'pg-nur',
    paceGroupName: 'Nur � 10 pages',
    paceGroupSize: 10,
    placedAt: new Date('2026-01-05'),
  },
  {
    profileId: 'p2',
    authUserId: 'u2',
    firstName: 'Sagal',
    fatherName: 'Ahmed',
    grandfatherName: null,
    userName: 'Sagal Ahmed',
    userEmail: 'sagal@example.com',
    profileTelegram: 'sagal_a',
    profilePhone: '+251922222222',
    appEmail: 'sagal@example.com',
    appTelegram: 'sagal_a',
    appPhone: '+251922222222',
    appPacePreference: '5',
    membershipId: 'bm2',
    batchMembershipStatus: 'active',
    enrolledAt: new Date('2026-01-02'),
    paceGroupMembershipId: null,
    paceGroupId: null,
    paceGroupName: null,
    paceGroupSize: null,
    placedAt: null,
  },
  {
    profileId: 'p3',
    authUserId: 'u3',
    firstName: 'Ilhan',
    fatherName: 'Mohamed',
    grandfatherName: null,
    userName: 'Ilhan Mohamed',
    userEmail: 'ilhan@example.com',
    profileTelegram: null,
    profilePhone: null,
    appEmail: 'ilhan@example.com',
    appTelegram: 'ilhan_m',
    appPhone: '+251933333333',
    appPacePreference: '20',
    membershipId: 'bm3',
    batchMembershipStatus: 'grace',
    enrolledAt: new Date('2026-01-03'),
    paceGroupMembershipId: null,
    paceGroupId: null,
    paceGroupName: null,
    paceGroupSize: null,
    placedAt: null,
  },
];

function createMockExecutor(
  batchData: typeof MOCK_BATCH | null,
  selectRows: unknown[],
) {
  const queryMock = {
    batches: {
      findFirst: vi.fn().mockResolvedValue(batchData),
    },
  };

  const selectMock = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(selectRows),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  });

  return {
    query: queryMock,
    select: selectMock,
  } as unknown as Parameters<typeof getBatchRoster>[1];
}

describe('Member Roster & Placement Query Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws BATCH_NOT_FOUND when target batch does not exist', async () => {
    const executor = createMockExecutor(null, []);

    await expect(
      getBatchRoster(
        { batchId: '00000000-0000-0000-0000-000000000000' },
        executor,
      ),
    ).rejects.toThrowError(PlacementError);
  });

  it('correctly derives placement status (placed vs unplaced) from database relationships', async () => {
    const executor = createMockExecutor(MOCK_BATCH, MOCK_RAW_ROWS);

    const result = await getBatchRoster({ batchId: MOCK_BATCH_ID }, executor);

    expect(result.batchId).toBe(MOCK_BATCH_ID);
    expect(result.batchName).toBe('Batch 5 � Ramadan');
    expect(result.totalMembers).toBe(3);
    expect(result.placedCount).toBe(1);
    expect(result.unplacedCount).toBe(2);

    // Member 1 is PLACED
    const hanan = result.members.find((m) => m.profileId === 'p1');
    expect(hanan).toBeDefined();
    expect(hanan?.placementStatus).toBe('placed');
    expect(hanan?.paceGroupId).toBe('pg-nur');
    expect(hanan?.paceGroupName).toBe('Nur � 10 pages');
    expect(hanan?.paceGroupSize).toBe(10);
    expect(hanan?.pacePreference).toBe('10');

    // Member 2 is UNPLACED
    const sagal = result.members.find((m) => m.profileId === 'p2');
    expect(sagal).toBeDefined();
    expect(sagal?.placementStatus).toBe('unplaced');
    expect(sagal?.paceGroupId).toBeNull();
    expect(sagal?.paceGroupName).toBeNull();
    expect(sagal?.pacePreference).toBe('5');

    // Member 3 is UNPLACED (grace status)
    const ilhan = result.members.find((m) => m.profileId === 'p3');
    expect(ilhan).toBeDefined();
    expect(ilhan?.placementStatus).toBe('unplaced');
    expect(ilhan?.batchMembershipStatus).toBe('grace');
    expect(ilhan?.pacePreference).toBe('20');
  });

  it('treats applications.paceGroup strictly as preference without modifying group assignment', async () => {
    const executor = createMockExecutor(MOCK_BATCH, [
      {
        ...MOCK_RAW_ROWS[1],
        appPacePreference: '40',
      },
    ]);

    const result = await getBatchRoster(
      { batchId: MOCK_BATCH_ID, pacePreference: '40' },
      executor,
    );

    expect(result.members[0].pacePreference).toBe('40');
    expect(result.members[0].placementStatus).toBe('unplaced');
    expect(result.members[0].paceGroupId).toBeNull();
  });

  it('calculates batch-wide placement statistics accurately', async () => {
    const executor = createMockExecutor(MOCK_BATCH, MOCK_RAW_ROWS);

    const stats = await getBatchPlacementStats(MOCK_BATCH_ID, executor);

    expect(stats.total).toBe(3);
    expect(stats.placed).toBe(1);
    expect(stats.unplaced).toBe(2);
  });
});
