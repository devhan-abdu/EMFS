import 'server-only';

import type { CurrentUser } from '@/lib/auth/session';
import type { AdminWorkspaceOption } from '@/lib/admin-workspace';
import { getAdminBatches, getAdminPaceGroups } from '@/lib/services/admin';

export async function getAdminWorkspaceOptions(currentUser: CurrentUser) {
  const [batches, paceGroups] = await Promise.all([
    getAdminBatches(currentUser),
    getAdminPaceGroups(currentUser),
  ]);
  const workspaceOptions: AdminWorkspaceOption[] = [
    ...(currentUser.profile.isSuperAdmin
      ? [
          {
            title: 'EMFSC Platform',
            href: '/admin/platform',
            kind: 'platform' as const,
          },
        ]
      : []),
    ...batches.map((batch) => ({
      title: `Batch · ${batch.name}`,
      href: `/admin/b/${batch.id}`,
      kind: 'batch' as const,
    })),
    ...paceGroups.map((group) => ({
      title: `Pace group · ${group.name} · ${group.batch}`,
      href: `/admin/g/${group.id}`,
      kind: 'group' as const,
    })),
  ];

  return { batches, paceGroups, workspaceOptions };
}
