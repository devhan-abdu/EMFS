import { redirect } from "next/navigation";
import { requireRole, AuthzError } from "@/lib/auth/authorize";
import { BookOpen, ChevronLeft, Gauge, Group, Settings } from "lucide-react";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole(["pace_admin"]);
  } catch (error) {
    if (error instanceof AuthzError && error.code === "FORBIDDEN") {
      redirect("/today");
    }
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface-2 px-4 md:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/today"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="font-heading text-lg font-bold text-primary">
            Admin Dashboard
          </span>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          EM
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface-2 p-6 lg:block">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Navigation
          </p>
          <nav className="space-y-2" aria-label="Admin navigation">
            <Link
              href="/today"
              className="flex items-center gap-4 rounded-lg px-4 py-4 text-sm text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
            >
              <Gauge className="h-4 w-4" /> Dashboard
            </Link>
            <Link
              href="/catalog"
              className="flex items-center gap-4 rounded-lg bg-primary px-4 py-4 text-sm font-medium text-primary-foreground"
            >
              <BookOpen className="h-4 w-4" /> Catalog Management
            </Link>
            <Link
              href="/groups"
              className="flex items-center gap-4 rounded-lg px-4 py-4 text-sm text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
            >
              <Group className="h-4 w-4" /> Users
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-4 rounded-lg px-4 py-4 text-sm text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </nav>
          <div className="mt-10 border-t border-border pt-6">
            <p className="text-xs font-semibold text-foreground">
              System Status
            </p>
            <p className="mt-2 text-xs text-secondary">
              All services operational
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
