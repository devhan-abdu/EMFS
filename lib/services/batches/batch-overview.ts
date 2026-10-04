import type { CurrentUser } from '@/lib/auth/session';
import { getAdminApplicationsWithHandoff } from '@/lib/services/application/admin-handoff';
import { getBatchDetail } from '@/lib/services/batches/batch-detail';
import { listPaceAdminAssignments } from '@/lib/services/pace-groups/pace-admin-assignment';
import { listPaceGroupsForBatch } from '@/lib/services/pace-groups/pace-group';
import { getBatchPlacementStats } from '@/lib/services/pace-groups/placement';

export async function getBatchOverviewData(
  batchId: string,
  currentUser: CurrentUser,
) {
  const [batch, applications, rawGroups, placementStats] = await Promise.all([
    getBatchDetail(batchId),
    getAdminApplicationsWithHandoff(batchId, currentUser),
    listPaceGroupsForBatch({ batchId, includeArchived: true }),
    getBatchPlacementStats(batchId),
  ]);

  const groups = await Promise.all(
    rawGroups.map(async (group) => ({
      ...group,
      admins: await listPaceAdminAssignments({ paceGroupId: group.id }),
    })),
  );

  return { batch, applications, groups, placementStats };
}
