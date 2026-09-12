import Link from "next/link";
import type { Metadata } from "next";

import { Lotus, LotusWatermark } from "@/components/brand/lotus";
import { SignInForm } from "@/components/auth/signin-form";

export const metadata: Metadata = {
  title: "Sign in — EMFSC Book Shelf",
  description:
    "Sign in to the EMFSC Book Shelf to see your daily pages, write reflections and follow your reading batch.",
  openGraph: {
    title: "Sign in — EMFSC Book Shelf",
    description: "Sign in to your EMFSC reading batch.",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
};

type SignInPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;

  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:flex-row">
      <aside className="relative hidden overflow-hidden bg-primary px-12 py-16 text-primary-foreground lg:flex lg:w-[46%] lg:flex-col lg:justify-between">
        <LotusWatermark className="pointer-events-none absolute -bottom-24 -right-20 h-96 w-96 text-primary-foreground/10" />
        <Link href="/" className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/10">
            <Lotus className="h-6 w-6" />
          </span>
          <span className="font-display text-lg font-semibold">
            EMFSC Book Shelf
          </span>
        </Link>
        <div className="relative max-w-md space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">
            Read together
          </p>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            A few pages a day, side by side with your sisters.
          </h2>
          <p className="text-sm leading-relaxed text-primary-foreground/70">
            Sign in to see today&apos;s pages, mark your reading and share your
            weekly reflection with your pace group.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/50">
          Ethiopian Muslim Female Students Circle
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-14 md:px-10">
        <div className="w-full max-w-sm rise-in">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Lotus className="h-6 w-6" />
            </span>
            <span className="font-display text-lg font-semibold text-foreground">
              EMFSC Book Shelf
            </span>
          </div>

          <h1 className="font-display text-3xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your email.
          </p>

          <SignInForm next={next ?? null} />
        </div>
      </main>
    </div>
  );
}
