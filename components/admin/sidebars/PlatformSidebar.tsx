'use client';

import { LayoutDashboard, Layers, BookOpen, ShieldCheck } from 'lucide-react';
import {
  AppSidebar,
  type AdminWorkspaceOption,
  type NavItem,
} from '../admin-shell';

const platformNavItems: NavItem[] = [
  { title: 'Overview', url: '/admin/platform', icon: LayoutDashboard },
  { title: 'Batches', url: '/admin/platform/batches', icon: Layers },
  { title: 'Catalog', url: '/admin/platform/catalog', icon: BookOpen },
  { title: 'Roles & Access', url: '/admin/platform/roles', icon: ShieldCheck },
  //   { title: 'Audit Log', url: '/admin/platform/audit', icon: History },
];

export function PlatformSidebar({
  user = { name: 'Hayat A.', role: 'Super Admin', avatarInitials: 'HA' },
  workspaceOptions,
}: {
  user?: { name: string; role: string; avatarInitials: string };
  workspaceOptions: AdminWorkspaceOption[];
}) {
  return (
    <AppSidebar
      workspaceTitle="EMFSC Platform"
      workspaceSubTitle="Global Management"
      groupLabel="Platform Tools"
      navItems={platformNavItems}
      workspaceOptions={workspaceOptions}
      user={user}
    />
  );
}
