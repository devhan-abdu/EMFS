import { redirect } from "next/navigation";
import { requireRole, AuthzError } from "@/lib/auth/authorize";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
      await requireRole(["pace_admin"]);
      // batch_admin, super_admin pass too (US-ADM-04)
  } catch (error) {
    if (error instanceof AuthzError && error.code === "FORBIDDEN") {
      redirect("/today");
    }
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
