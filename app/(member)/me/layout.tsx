import { MemberNav } from "@/components/member/member-shell";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/authorize";
async function MemberLayout({ children }: { children: React.ReactNode }) {
    try {
      await requireSession();
    } catch {
      const path = (await headers()).get("x-pathname") ?? "/me";
      redirect(`/signin?next=${encodeURIComponent(path)}`);
    }
  return (
    <div className="min-h-screen bg-background">
      <MemberNav />
      <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-8 md:px-8 md:pb-16 md:pt-10">
        {children}
      </main>
    </div>
  );
}

export default MemberLayout;
