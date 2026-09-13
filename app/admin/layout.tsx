import { AdminSidebar, AdminTopBar } from "@/components/admin/admin-shell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthzError, requireMinRole } from "@/lib/auth/authorize";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return {
    title: "Admin",
  };
}
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
  }) {
  try {
    await requireMinRole("pace_admin");
  } catch (e) {
    if (e instanceof AuthzError) {
      redirect(
        e.code === "UNAUTHENTICATED" ?
          `/signin?next=${encodeURIComponent("/admin")}`
        : "/",
      );
    }
    throw e;
  }
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 md:py-10">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}