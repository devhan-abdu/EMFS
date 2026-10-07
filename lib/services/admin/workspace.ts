export const ADMIN_LAST_WORKSPACE_COOKIE = 'emfs-admin-last-workspace';

export type AdminPaceGroupOption = {
  id: string;
  title: string;
  href: string;
  searchOnly: boolean;
};

export type AdminWorkspaceOption =
  | {
      title: string;
      href: string;
      kind: 'platform';
    }
  | {
      id: string;
      title: string;
      href: string | null;
      kind: 'batch';
      searchOnly: boolean;
      groups: AdminPaceGroupOption[];
    };

type BatchWorkspaceOption = Extract<AdminWorkspaceOption, { kind: 'batch' }>;

export type AdminWorkspaceScope =
  | { kind: 'platform' }
  | { kind: 'batch'; id: string }
  | { kind: 'group'; id: string };

type AssignedBatch = {
  id: string;
  name: string;
  registrationOpen: boolean;
  startDate: string | null;
};

type AssignedPaceGroup = {
  id: string;
  name: string;
  batchId: string;
  batchName: string;
  archived: boolean;
};

export function buildAdminWorkspaceOptions({
  isSuperAdmin,
  batches,
  paceGroups,
  today,
}: {
  isSuperAdmin: boolean;
  batches: AssignedBatch[];
  paceGroups: AssignedPaceGroup[];
  today: string;
}): AdminWorkspaceOption[] {
  const batchesById = new Map<string, BatchWorkspaceOption>();
  for (const batch of batches) {
    batchesById.set(batch.id, {
      id: batch.id,
      title: batch.name,
      href: `/admin/b/${batch.id}`,
      kind: 'batch' as const,
      searchOnly: !(
        batch.registrationOpen ||
        Boolean(batch.startDate && batch.startDate <= today)
      ),
      groups: [] as AdminPaceGroupOption[],
    });
  }

  for (const group of paceGroups) {
    let batch = batchesById.get(group.batchId);
    if (!batch) {
      batch = {
        id: group.batchId,
        title: group.batchName,
        href: null,
        kind: 'batch',
        searchOnly: false,
        groups: [],
      };
      batchesById.set(group.batchId, batch);
    }

    batch.groups.push({
      id: group.id,
      title: group.name,
      href: `/admin/g/${group.id}`,
      searchOnly: group.archived,
    });
  }

  return [
    ...(isSuperAdmin
      ? [
          {
            title: 'EMFSC Platform',
            href: '/admin/platform',
            kind: 'platform' as const,
          },
        ]
      : []),
    ...batchesById.values(),
  ];
}

export function parseWorkspaceCookie(
  value: string | undefined,
  profileId: string,
): string | undefined {
  const prefix = `${profileId}:`;
  return value?.startsWith(prefix) ? value.slice(prefix.length) : undefined;
}

export function buildWorkspaceCookie(profileId: string, path: string): string {
  return `${profileId}:${path}`;
}
