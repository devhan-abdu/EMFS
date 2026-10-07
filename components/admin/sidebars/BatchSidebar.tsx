// components/admin/sidebars/BatchSidebar.tsx
'use client';

import {
  LayoutDashboard,
  UserRoundCheck,
  Users,
  ArrowLeftRight,
  History,
  TrendingUp,
  Settings,
} from 'lucide-react';
import {
  AppSidebar,
  type AdminWorkspaceOption,
  type NavItem,
} from '../admin-shell';

export function BatchSidebar({
  batchId,
  workspaceTitle,
  workspaceOptions,
  user = { name: 'Batch Admin', role: 'Batch Manager', avatarInitials: 'BA' },
  pendingMovesCount,
  signOutAction,
}: {
  batchId: string;
  workspaceTitle?: string;
  workspaceOptions: AdminWorkspaceOption[];
  user?: { name: string; role: string; avatarInitials: string };
  pendingMovesCount?: number;
  signOutAction: () => Promise<void>;
}) {
  const batchNavItems: NavItem[] = [
    {
      title: 'Overview',
      url: `/admin/b/${batchId}`,
      icon: LayoutDashboard,
    },
    {
      title: 'Applications',
      url: `/admin/b/${batchId}/applications`,
      icon: UserRoundCheck,
    },
    {
      title: 'Batch Progress',
      url: `/admin/b/${batchId}/tasks`,
      icon: TrendingUp,
    },
    {
      title: 'Roster & Members',
      url: `/admin/b/${batchId}/members`,
      icon: Users,
    },
    { title: 'Pace Groups', url: `/admin/b/${batchId}/groups`, icon: Users },
    {
      title: 'Volunteer Requests',
      url: `/admin/b/${batchId}/volunteers`,
      icon: UserRoundCheck,
    },
    {
      title: 'Move Requests',
      url: `/admin/b/${batchId}/move`,
      icon: ArrowLeftRight,
      badge: pendingMovesCount,
    },
    {
      title: 'Move History',
      url: `/admin/b/${batchId}/history`,
      icon: History,
    },
    {
      title: 'Settings & Offsets',
      url: `/admin/b/${batchId}/settings`,
      icon: Settings,
    },
  ];

  return (
    <AppSidebar
      workspaceTitle={workspaceTitle ?? `Batch ${batchId.substring(0, 8)}...`}
      workspaceSubTitle="Batch Administration"
      groupLabel="Batch Operations"
      navItems={batchNavItems}
      workspaceOptions={workspaceOptions}
      user={user}
      signOutAction={signOutAction}
    />
  );
}
