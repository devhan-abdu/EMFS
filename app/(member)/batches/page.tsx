import Link from "next/link";
import type { Metadata } from "next";

import { Lotus } from "@/components/brand/lotus";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page-layout";
import { OpenBatchCard } from "@/components/batches/open-batch-card";
import { getOpenBatchesForPublic } from "@/lib/services/batches/batch-public";

export const metadata: Metadata = {
  title: "Open reading batches — EMFSC Book Shelf",
  description:
    "Browse EMFSC reading batches currently open for registration and join the circle.",
  openGraph: {
    title: "Open reading batches — EMFSC Book Shelf",
    description: "Browse open reading batches and join the circle.",
  },
};

export default async function PublicBatchesPage() {
  const batches = await getOpenBatchesForPublic();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
            <Lotus className="h-5 w-5" />
          </span>
          <span className="font-display text-base font-semibold text-foreground">
            Book Shelf
          </span>
        </Link>
        <Button variant="outline" asChild>
          <Link href="/signin">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 md:py-16">
        <div className="max-w-2xl rise-in">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
            Join the circle
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-foreground md:text-4xl">
            Open reading batches
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            These batches are currently accepting registrations. Sign in (or
            create an account) to apply — full batches route you to the waiting
            list automatically.
          </p>
        </div>

        {batches.length === 0 ?
          <div className="mt-10">
            <EmptyState
              title="No open batches right now"
              description="Check back soon — new batches open for registration periodically."
            />
          </div>
        : <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <OpenBatchCard key={batch.id} batch={batch} />
            ))}
          </div>
        }
      </main>
    </div>
  );
}
