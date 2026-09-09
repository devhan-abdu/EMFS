"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BookOpen,
  LayoutDashboard,
  Layers,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Lotus } from "@/components/brand/lotus";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Batches", url: "/admin/batches", icon: Layers },
  { title: "Applications", url: "/admin/members", icon: UserRoundCheck },
  { title: "Pace groups", url: "/admin/pace-groups", icon: Users },
  { title: "Book catalog", url: "/admin/catalog", icon: BookOpen },
  { title: "Roles & access", url: "/admin/roles", icon: ShieldCheck },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (url: string) =>
    url === "/admin" ? pathname === "/admin" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-foreground">
            <Lotus className="h-5 w-5" />
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-display text-sm font-semibold text-sidebar-foreground">
              EMFSC Book Shelf
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              Admin workspace
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Link href={item.url} className="flex items-center gap-3">
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.title}</span>
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
            HA
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm text-sidebar-foreground">Hayat A.</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Super admin</p>
          </div>
          <Link
            href="/signin"
            aria-label="Sign out"
            title="Sign out"
            className="ml-auto rounded-md p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="size-4" />
          </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle colour mode"
      onClick={() => setDark((d) => !d)}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function AdminTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur md:px-8">
      <SidebarTrigger />
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}

