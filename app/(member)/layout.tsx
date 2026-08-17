import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/authorize";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  );
}
