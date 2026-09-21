import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarDays, Clock, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { OpenBatchCardData } from '@/components/batches/open-batch-card';

export function FeaturedBatchCard({ batch }: { batch: OpenBatchCardData }) {
  const seatsLeft = batch.maxMembers - batch.enrolled;
  const isFull = seatsLeft <= 0 || batch.isFull;

  return (
    <Card className="card-soft shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-5 p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
              Now registering
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground md:text-3xl">
              {batch.name}
            </h2>
          </div>
          <span
            className={
              !isFull
                ? 'rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary'
                : 'rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold-foreground'
            }
          >
            {!isFull ? `${seatsLeft} places left` : 'Waiting list'}
          </span>
        </div>

        {/* Batch Metadata Details */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            Starts {batch.startDate ?? 'soon'}
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-3.5" />
            {batch.readingDaysPerWeek} reading days a week
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            {batch.enrolled} of {batch.maxMembers} taken
          </span>
        </div>

        {/* Capacity Progress Bar */}
        <Progress
          value={(batch.enrolled / batch.maxMembers) * 100}
          className="h-1.5"
        />

        {/* Action Link Button */}
        <Button size="lg" asChild className="w-full sm:w-auto">
          <Link href={`/batches/${batch.id}/apply`}>
            {!isFull ? (
              <>
                Apply for this batch
                <ArrowRight className="ml-1.5 size-4" />
              </>
            ) : (
              <>
                <Clock className="mr-1.5 size-4" />
                Join the waiting list
              </>
            )}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
