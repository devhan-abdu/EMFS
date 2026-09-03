import { redirect } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { requireRole } from "@/lib/auth/authorize";
import Image from "next/image";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ModeToggle } from "@/components/ui/mode-toggle";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    await requireRole(["pace_admin", "batch_admin", "super_admin"]);
  } catch {
    redirect("/login");
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-surface-2/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex items-center gap-4">
              <Link
                href="/catalog"
                aria-label="Back to Catalog"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
              >
                <span className="material-symbols-outlined text-2xl">
                  chevron_left
                </span>
              </Link>
              <h1 className="text-xl font-semibold text-foreground">
                Admin Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ModeToggle />
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2">
                <Image
                  src="/emfsc-logo.jpg"
                  alt="EMFSC logo"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain p-0.5"
                  priority
                />
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </div>
      {process.env.NODE_ENV === "production" && <Analytics />}
    </ThemeProvider>
  );
}
