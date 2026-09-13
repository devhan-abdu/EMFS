import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpen,
  HeartHandshake,
  NotebookPen,
} from "lucide-react";
import Image from "next/image";

import { Lotus } from "@/components/brand/lotus";
import { Button } from "@/components/ui/button";
import { OpenBatchCard } from "@/components/batches/open-batch-card";
import { FeaturedBatchCard } from "@/components/batches/featured-batch-card";
import { getOpenBatchesForPublic } from "@/lib/services/batches/batch-public";

export const metadata: Metadata = {
  title: "EMFSC Book Shelf — Read together, grow together",
  description:
    "The reading home of the Ethiopian Muslim Female Students Circle: shared reading batches, daily pages, weekly reflections and a circle that keeps you going.",
  openGraph: {
    title: "EMFSC Book Shelf",
    description: "Shared reading batches, daily pages and weekly reflections.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
};

const pillars = [
  {
    icon: BookOpen,
    title: "Read at a shared pace",
    body: "Every batch reads together, a few pages a day, with a pace admin adjusting the rhythm as the group moves.",
  },
  {
    icon: NotebookPen,
    title: "Reflect each week",
    body: "Private reflections stay yours; weekly submissions keep the circle honest and visible instead of lost in a chat.",
  },
  {
    icon: HeartHandshake,
    title: "Grow with your circle",
    body: "Attendance, streaks and gentle nudges — built for encouragement, not pressure.",
  },
];

const FEATURED_LIMIT = 3;

export default async function Home() {
  const openBatches = await getOpenBatchesForPublic();
  const visibleBatches = openBatches.slice(0, FEATURED_LIMIT);
  const hasMore = openBatches.length > FEATURED_LIMIT;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <div className="relative h-24 w-24">
          <Image
            src="/brand/logo.png"
            alt="EMFSC Book Shelf"
            fill
            className="object-contain dark:hidden"
            priority
          />
        </div>
        <Button variant="outline" asChild>
          <Link href="/signin">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/60 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 top-40 size-80 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
            <div className="max-w-2xl rise-in">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
                Ethiopian Muslim Female Students Circle
              </p>
              <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] text-foreground md:text-6xl">
                Read together.
                <br />
                Grow together.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                A quiet, steady home for our reading circle — shared batches,
                daily pages, weekly reflections, and sisters who notice when you
                go quiet.
              </p>

              {visibleBatches.length === 0 ?
                <div className="mt-9 flex flex-wrap gap-3">
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/signin">
                      Sign in
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              : null}
            </div>
          </div>
        </section>

        {visibleBatches.length === 1 ?
          <section className="mx-auto max-w-6xl px-6 pb-16">
            <FeaturedBatchCard batch={visibleBatches[0]!} />
          </section>
        : null}

        {visibleBatches.length > 1 ?
          <section className="mx-auto max-w-6xl px-6 pb-16">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Open reading batches
              </h2>
              {hasMore ?
                <Link
                  href="/batches"
                  className="flex shrink-0 items-center gap-1 text-sm font-medium text-teal underline-offset-4 hover:underline"
                >
                  See all open batches
                  <ArrowRight className="size-3.5" />
                </Link>
              : null}
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBatches.map((batch) => (
                <OpenBatchCard key={batch.id} batch={batch} />
              ))}
            </div>
          </section>
        : null}

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="card-soft rounded-2xl border border-border bg-card p-7"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <p.icon className="size-5" />
                </span>
                <h2 className="mt-5 font-display text-xl font-semibold text-foreground">
                  {p.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-10 text-center">
          <Lotus className="h-8 w-8 text-primary/30" />
          <p className="text-sm text-muted-foreground">
            EMFSC Book Shelf — built for the circle, by the circle.
          </p>
        </div>
      </footer>
    </div>
  );
}
