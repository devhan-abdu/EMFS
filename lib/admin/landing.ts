import { parseWorkspaceCookie } from '@/lib/admin-workspace';
import type { AdminBatch, AdminPaceGroup } from '@/lib/services/admin';

type LandingUser = {
  profile: {
    id: string;
    isSuperAdmin: boolean;
  };
};

type LandingBatch = Pick<
  AdminBatch,
  'id' | 'name' | 'registrationOpen' | 'startDate' | 'createdAt'
>;

type LandingGroup = Pick<AdminPaceGroup, 'id' | 'name' | 'createdAt'>;

function compareBatches(
  left: LandingBatch,
  right: LandingBatch,
  today: string,
) {
  const leftIsActive =
    left.registrationOpen || Boolean(left.startDate && left.startDate <= today);
  const rightIsActive =
    right.registrationOpen ||
    Boolean(right.startDate && right.startDate <= today);

  return (
    Number(rightIsActive) - Number(leftIsActive) ||
    right.createdAt.getTime() - left.createdAt.getTime() ||
    left.name.localeCompare(right.name)
  );
}

export function resolveAdminLanding(
  user: LandingUser,
  batches: LandingBatch[],
  groups: LandingGroup[],
  savedCookie?: string,
  today = new Date().toISOString().slice(0, 10),
): string {
  if (user.profile.isSuperAdmin) return '/admin/platform';

  const savedWorkspace = parseWorkspaceCookie(savedCookie, user.profile.id);
  const savedBatch = batches.find(
    (batch) => savedWorkspace === `/admin/b/${batch.id}`,
  );
  if (savedBatch) return `/admin/b/${savedBatch.id}`;

  const savedGroup = groups.find(
    (group) => savedWorkspace === `/admin/g/${group.id}`,
  );
  if (savedGroup) return `/admin/g/${savedGroup.id}`;

  const preferredBatch = [...batches].sort((left, right) =>
    compareBatches(left, right, today),
  )[0];
  if (preferredBatch) return `/admin/b/${preferredBatch.id}`;

  const preferredGroup = [...groups].sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() ||
      left.name.localeCompare(right.name),
  )[0];
  if (preferredGroup) return `/admin/g/${preferredGroup.id}`;

  return '/me';
}
