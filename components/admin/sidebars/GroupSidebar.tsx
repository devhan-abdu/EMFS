// components/admin/sidebars/GroupSidebar.tsx
'use client';

import {
  LayoutDashboard,
  CheckSquare,
  CalendarCheck,
  MessageSquareQuote,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  AppSidebar,
  type AdminWorkspaceOption,
  type NavItem,
} from '../admin-shell';

interface GroupDutyFlags {
  hasDailyTaskDuty?: boolean;
  hasAttendanceDuty?: boolean;
  hasReflectionDuty?: boolean;
  hasInspirationDuty?: boolean;
}

export function GroupSidebar({
  groupId,
  workspaceTitle,
  workspaceOptions,
  duties = {
    hasDailyTaskDuty: true,
    hasAttendanceDuty: true,
    hasReflectionDuty: true,
    hasInspirationDuty: true,
  },
  user = { name: 'Pace Lead', role: 'Group Admin', avatarInitials: 'PL' },
}: {
  groupId: string;
  workspaceTitle?: string;
  workspaceOptions: AdminWorkspaceOption[];
  duties?: GroupDutyFlags;
  user?: { name: string; role: string; avatarInitials: string };
}) {
  const allNavItems: (NavItem & { dutyKey?: keyof GroupDutyFlags })[] = [
    {
      title: 'Group Overview',
      url: `/admin/g/${groupId}`,
      icon: LayoutDashboard,
    },
    {
      title: 'Daily Tasks',
      url: `/admin/g/${groupId}/task`,
      icon: CheckSquare,
      dutyKey: 'hasDailyTaskDuty',
    },
    {
      title: 'Attendance',
      url: `/admin/g/${groupId}/attendance`,
      icon: CalendarCheck,
      dutyKey: 'hasAttendanceDuty',
    },
    {
      title: 'Reflections',
      url: `/admin/g/${groupId}/reflections`,
      icon: MessageSquareQuote,
      dutyKey: 'hasReflectionDuty',
    },
    {
      title: 'Inspiration',
      url: `/admin/g/${groupId}/inspiration`,
      icon: Sparkles,
      dutyKey: 'hasInspirationDuty',
    },
    {
      title: 'Group Progress',
      url: `/admin/g/${groupId}/progress`,
      icon: TrendingUp,
    },
  ];

  // Duty-Aware Filtering
  const activeNavItems = allNavItems.filter((item) => {
    if (!item.dutyKey) return true;
    return Boolean(duties[item.dutyKey]);
  });

  return (
    <AppSidebar
      workspaceTitle={workspaceTitle ?? `Group ${groupId.substring(0, 8)}...`}
      workspaceSubTitle="Pace Group Workspace"
      groupLabel="Group Duties"
      navItems={activeNavItems}
      workspaceOptions={workspaceOptions}
      user={user}
    />
  );
}
