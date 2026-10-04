import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { BatchSidebar } from '@/components/admin/sidebars/BatchSidebar';
import { GroupSidebar } from '@/components/admin/sidebars/GroupSidebar';
import { PlatformSidebar } from '@/components/admin/sidebars/PlatformSidebar';
import { AdminTopBar } from '@/components/admin/admin-shell';
import { SidebarRouteCloser } from '@/components/admin/sidebar-route-closer';
import { WorkspaceVisitTracker } from '@/components/admin/workspace-visit-tracker';
import { SidebarProvider } from '@/components/ui/sidebar';
import {
  AuthzError,
  requireBatchAccess,
  requirePaceGroupAccess,
  requireSuperAdmin,
} from '@/lib/auth/authorize';
import type { CurrentUser } from '@/lib/auth/session';
import { getAdminWorkspaceOptions } from '@/lib/admin/workspaces';

type WorkspaceScope =
  | { kind: 'platform' }
  | { kind: 'batch'; id: string }
  | { kind: 'group'; id: string };

export async function AdminWorkspaceLayout({
  children,
  scope,
}: {
  children: ReactNode;
  scope: WorkspaceScope;
}) {
  let currentUser: CurrentUser;
  try {
    currentUser =
      scope.kind === 'platform'
        ? await requireSuperAdmin()
        : scope.kind === 'batch'
          ? await requireBatchAccess(scope.id)
          : await requirePaceGroupAccess(scope.id);
  } catch (error) {
    if (error instanceof AuthzError) redirect('/admin');
    throw error;
  }

  const { batches, paceGroups, workspaceOptions } =
    await getAdminWorkspaceOptions(currentUser);
  const profileName = [
    currentUser.profile.firstName,
    currentUser.profile.fatherName,
    currentUser.profile.grandfatherName,
  ]
    .filter(Boolean)
    .join(' ');
  const sidebarUser = {
    name: profileName || currentUser.email || 'Admin',
    role: currentUser.profile.isSuperAdmin
      ? 'Super Admin'
      : scope.kind === 'batch'
        ? 'Batch Admin'
        : 'Pace Admin',
    avatarInitials: profileName
      ? profileName
          .split(' ')
          .map((namePart) => namePart[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : 'AD',
  };
  const workspacePath =
    scope.kind === 'platform'
      ? '/admin/platform'
      : scope.kind === 'batch'
        ? `/admin/b/${scope.id}`
        : `/admin/g/${scope.id}`;
  const currentWorkspaceTitle =
    scope.kind === 'batch'
      ? batches.find((batch) => batch.id === scope.id)?.name
      : scope.kind === 'group'
        ? paceGroups.find((group) => group.id === scope.id)?.name
        : undefined;

  return (
    <SidebarProvider>
      <SidebarRouteCloser />
      <div className="flex min-h-screen w-full">
        <WorkspaceVisitTracker
          profileId={currentUser.profile.id}
          workspacePath={workspacePath}
        />
        {scope.kind === 'platform' ? (
          <PlatformSidebar
            user={{ ...sidebarUser, role: 'Super Admin' }}
            workspaceOptions={workspaceOptions}
          />
        ) : scope.kind === 'batch' ? (
          <BatchSidebar
            batchId={scope.id}
            workspaceTitle={currentWorkspaceTitle}
            workspaceOptions={workspaceOptions}
            user={sidebarUser}
          />
        ) : (
          <GroupSidebar
            groupId={scope.id}
            workspaceTitle={currentWorkspaceTitle}
            workspaceOptions={workspaceOptions}
            user={sidebarUser}
          />
        )}
        <div className="flex flex-1 flex-col">
          <AdminTopBar />
          <main className="flex-1 p-6 md:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
