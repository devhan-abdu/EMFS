"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, LineChart, NotebookPen } from "lucide-react";

import { Lotus } from "@/components/brand/lotus";
import { cn } from "@/lib/utils";

const memberNav = [
  { title: "Today", url: "/me", icon: BookOpenCheck },
  { title: "Reflections", url: "/me/reflections", icon: NotebookPen },
  { title: "My progress", url: "/me/progress", icon: LineChart },
] as const;

export function MemberNav() {
  const pathname = usePathname();
  const isActive = (url: string) =>
    url === "/me" ? pathname === "/me" : pathname.startsWith(url);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-3 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
              <Lotus className="h-5 w-5" />
            </span>
            <span className="hidden font-display text-base font-semibold text-foreground sm:block">
              Book Shelf
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {memberNav.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive(item.url) ?
                    "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>

          <Link
            href="/signin"
            className="ml-auto flex size-9 items-center justify-center rounded-full bg-surface-container text-xs font-semibold text-foreground md:ml-3"
            aria-label="Your account"
          >
            AY
          </Link>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="flex">
          {memberNav.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                isActive(item.url) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.title}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
