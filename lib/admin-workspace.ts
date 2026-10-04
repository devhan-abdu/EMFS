export const ADMIN_LAST_WORKSPACE_COOKIE = 'emfs-admin-last-workspace';

export type AdminWorkspaceOption = {
  title: string;
  href: string;
  kind: 'platform' | 'batch' | 'group';
};

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
