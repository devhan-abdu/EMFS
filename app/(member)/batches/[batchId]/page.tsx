import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { Lotus } from '@/components/brand/lotus';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getBatchDetailsForPublic } from '@/lib/services/batches/batch-public';

type PageProps = {
  params: Promise<{
    batchId: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { batchId } = await params;
  const batch = await getBatchDetailsForPublic(batchId);

  if (!batch) {
    return {
      title: 'Batch Not Found — EMFSC Book Shelf',
    };
  }

  return {
    title: `${batch.name} — EMFSC Book Shelf`,
    description: `Details and schedule for ${batch.name}. Read together, share reflections, and track progress.`,
  };
}

export default async function BatchDetailPage({ params }: PageProps) {
  const { batchId } = await params;
  const batch = await getBatchDetailsForPublic(batchId);

  if (!batch) {
    notFound();
  }

  const seatsLeft = batch.maxMembers - batch.enrolled;
  const isFull = seatsLeft <= 0 || batch.isFull;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-20 max-w-4xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Lotus className="h-7 w-7 text-primary" />
          <span className="font-display text-lg font-semibold text-foreground">
            EMFSC Book Shelf
          </span>
        </Link>
        <Button variant="outline" size="sm" asChild>
          <Link href="/batches">Back to batches</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        {/* Title & Banner */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
            {!isFull ? 'Registration open' : 'Waiting list active'}
          </p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground md:text-5xl">
            {batch.name}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            {!isFull
              ? 'Read a few pages a day with your pace group, share weekly reflections, and keep each other accountable throughout the batch.'
              : 'All initial spots are filled. You can still apply to join the waiting list—if a spot opens up, a batch admin will invite you.'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="card-soft">
            <CardContent className="space-y-2 p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                <CalendarDays className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Starts On
              </p>
              <p className="font-display text-lg font-semibold text-foreground">
                {batch.startDate ?? 'To be announced'}
              </p>
            </CardContent>
          </Card>

          <Card className="card-soft">
            <CardContent className="space-y-2 p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                <BookOpen className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Daily Rhythm
              </p>
              <p className="font-display text-lg font-semibold text-foreground">
                {batch.readingDaysPerWeek} days a week
              </p>
            </CardContent>
          </Card>

          <Card className="card-soft">
            <CardContent className="space-y-2 p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                <Users className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Capacity
              </p>
              <p className="font-display text-lg font-semibold text-foreground">
                {batch.enrolled} of {batch.maxMembers} filled
              </p>
              <Progress
                value={(batch.enrolled / batch.maxMembers) * 100}
                className="h-1.5"
              />
            </CardContent>
          </Card>
        </div>

        {/* Direct Action Card */}
        <Card className="card-soft mt-8 border-primary/20">
          <CardContent className="flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-display text-xl font-semibold text-foreground">
                {!isFull
                  ? `${seatsLeft} places remaining`
                  : 'Batch is currently full'}
              </p>
              <p className="text-sm text-muted-foreground">
                {!isFull
                  ? 'Spots are reserved in real-time as applications are submitted.'
                  : 'Join the waiting list to get notified when seats free up.'}
              </p>
            </div>
            <Button size="lg" asChild className="shrink-0">
              <Link href={`/batches/${batch.id}/apply`}>
                {!isFull ? (
                  <>
                    Apply for this batch
                    <ArrowRight className="ml-1.5 size-4" />
                  </>
                ) : (
                  <>
                    <Clock className="mr-1.5 size-4" />
                    Join waiting list
                  </>
                )}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Expectations Breakdown */}
        <div className="mt-12 space-y-6">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            What to expect
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6">
              <Sparkles className="size-5 text-teal" />
              <h3 className="mt-3 font-semibold text-foreground">
                1. Daily Reading
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Receive assigned page goals each reading day directly on
                Telegram.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <Users className="size-5 text-teal" />
              <h3 className="mt-3 font-semibold text-foreground">
                2. Pace Groups
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Be assigned to a small group of sisters matching your reading
                speed.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <ShieldCheck className="size-5 text-teal" />
              <h3 className="mt-3 font-semibold text-foreground">
                3. Reflection Logs
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Submit weekly check-ins to build consistency and keep your
                streak active.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
