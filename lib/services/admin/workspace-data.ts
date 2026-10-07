import 'server-only';

import { asc, eq, inArray, or } from 'drizzle-orm';

import { db } from '@/db';
import {
  batchAdmins,
  batches,
  paceAdminAssignments,
  paceGroups,
} from '@/db/schema';
import type { CurrentUser } from '@/lib/auth/session';
import {
  type AdminWorkspaceOption,
  buildAdminWorkspaceOptions,
  type AdminWorkspaceScope,
} from '@/lib/services/admin/workspace';

export async function getAdminWorkspaceRecords(currentUser: CurrentUser) {
  const profileId = currentUser.profile.id;
  const assignedBatchIds = db
    .select({ id: batchAdmins.batchId })
    .from(batchAdmins)
    .where(eq(batchAdmins.profileId, profileId));
  const assignedPaceGroupIds = db
    .select({ id: paceAdminAssignments.paceGroupId })
    .from(paceAdminAssignments)
    .where(eq(paceAdminAssignments.profileId, profileId));
  const batchConditions = currentUser.profile.isSuperAdmin
    ? undefined
    : inArray(batches.id, assignedBatchIds);
  const groupConditions = currentUser.profile.isSuperAdmin
    ? undefined
    : or(
        inArray(paceGroups.batchId, assignedBatchIds),
        inArray(paceGroups.id, assignedPaceGroupIds),
      );

  const [availableBatches, visiblePaceGroups] = await Promise.all([
    db
      .select({
        id: batches.id,
        name: batches.name,
        registrationOpen: batches.registrationOpen,
        startDate: batches.startDate,
        createdAt: batches.createdAt,
      })
      .from(batches)
      .where(batchConditions)
      .orderBy(asc(batches.name)),
    db
      .selectDistinct({
        id: paceGroups.id,
        name: paceGroups.name,
        batchId: paceGroups.batchId,
        batchName: batches.name,
        archived: paceGroups.archived,
        createdAt: paceGroups.createdAt,
      })
      .from(paceGroups)
      .innerJoin(batches, eq(batches.id, paceGroups.batchId))
      .where(groupConditions)
      .orderBy(asc(batches.name), asc(paceGroups.name)),
  ]);

  return { batches: availableBatches, paceGroups: visiblePaceGroups };
}

export async function getAdminWorkspaceData(
  currentUser: CurrentUser,
  scope: AdminWorkspaceScope,
) {
  const { batches, paceGroups } = await getAdminWorkspaceRecords(currentUser);
  const workspaceOptions = buildAdminWorkspaceOptions({
    isSuperAdmin: currentUser.profile.isSuperAdmin,
    batches,
    paceGroups,
    today: new Date().toISOString().slice(0, 10),
  });
  const currentWorkspaceTitle = getCurrentWorkspaceTitle(
    scope,
    workspaceOptions,
  );

  return { currentWorkspaceTitle, workspaceOptions };
}

function getCurrentWorkspaceTitle(
  scope: AdminWorkspaceScope,
  options: AdminWorkspaceOption[],
) {
  if (scope.kind === 'platform') return undefined;

  if (scope.kind === 'batch') {
    return options.find(
      (option) => option.kind === 'batch' && option.id === scope.id,
    )?.title;
  }

  for (const option of options) {
    if (option.kind !== 'batch') continue;
    const group = option.groups.find((item) => item.id === scope.id);
    if (group) return group.title;
  }
  return undefined;
}
