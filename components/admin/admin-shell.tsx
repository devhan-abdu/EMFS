// components/admin/AppSidebarShell.tsx
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, type LucideIcon } from 'lucide-react';

import { WorkspaceSwitcher } from '@/components/admin/WorkspaceSwitcher';
import { Lotus } from '@/components/brand/lotus';
import { ModeToggle } from '@/components/ui/mode-toggle';
import type { AdminWorkspaceOption } from '@/lib/services/admin/workspace';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: string | number;
}
export type { AdminWorkspaceOption } from '@/lib/services/admin/workspace';

interface AppSidebarShellProps {
  workspaceTitle: string;
  workspaceSubTitle: string;
  groupLabel: string;
  navItems: NavItem[];
  workspaceOptions: AdminWorkspaceOption[];
  user: {
    name: string;
    role: string;
    avatarInitials: string;
  };
  /** Server action passed from the server layout. Must clear the workspace cookie. */
  signOutAction: () => Promise<void>;
}

/**
 * Exactly one nav item is active: the one with the longest url that is the
 * current path or a parent of it. This keeps "Overview" (/admin/b/123) from
 * lighting up on /admin/b/123/members.
 */
function findActiveUrl(navItems: NavItem[], pathname: string): string | null {
  let best: string | null = null;
  for (const { url } of navItems) {
    const matches = pathname === url || pathname.startsWith(`${url}/`);
    if (matches && (best === null || url.length > best.length)) best = url;
  }
  return best;
}

export function AppSidebar({
  workspaceTitle,
  workspaceSubTitle,
  groupLabel,
  navItems,
  workspaceOptions,
  user,
  signOutAction,
}: AppSidebarShellProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const activeUrl = useMemo(
    () => findActiveUrl(navItems, pathname),
    [navItems, pathname],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-4">
        <WorkspaceSwitcher
          options={workspaceOptions}
          currentTitle={workspaceTitle}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-foreground">
              <Lotus className="h-5 w-5" />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block truncate font-display text-sm font-semibold text-sidebar-foreground">
                {workspaceTitle}
              </span>
              <span className="block truncate text-xs text-sidebar-foreground/60">
                {workspaceSubTitle}
              </span>
            </span>
          </span>
        </WorkspaceSwitcher>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            {groupLabel}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.url === activeUrl}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Link
                      href={item.url}
                      aria-current={item.url === activeUrl ? 'page' : undefined}
                      className="flex items-center gap-3"
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.title}</span>
                      {item.badge ? (
                        <span className="ml-auto rounded-full bg-sidebar-primary/20 px-2 py-0.5 text-[10px] font-semibold text-sidebar-primary group-data-[collapsible=icon]:hidden">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {user.avatarInitials}
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm text-sidebar-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {user.role}
            </p>
          </div>
          {/* A form + server action: sign-out must never be a prefetchable GET link. */}
          <form
            action={signOutAction}
            className="ml-auto group-data-[collapsible=icon]:hidden"
          >
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur md:px-8">
      <SidebarTrigger />
      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
      </div>
    </header>
  );
}
