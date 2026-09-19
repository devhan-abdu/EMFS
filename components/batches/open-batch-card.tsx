import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarDays, Clock, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export type OpenBatchCardData = {
  id: string;
  name: string;
  startDate: string | null;
  enrolled: number;
  maxMembers: number;
  readingDaysPerWeek: number;
  isFull: boolean;
};

export function OpenBatchCard({ batch }: { batch: OpenBatchCardData }) {
  const seatsLeft = batch.maxMembers - batch.enrolled;
  const isFull = seatsLeft <= 0 || batch.isFull;

  return (
    <Card className="card-soft flex h-full flex-col shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col justify-between p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/batches/${batch.id}`} className="group">
              <h3 className="line-clamp-2 font-display text-xl font-semibold leading-snug text-foreground group-hover:text-teal group-hover:underline">
                {batch.name}
              </h3>
            </Link>
            <span
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                !isFull
                  ? 'bg-accent text-primary'
                  : 'bg-gold/15 text-gold-foreground'
              }`}
            >
              {!isFull ? `${seatsLeft} places left` : 'Waiting list'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 truncate">
              <CalendarDays className="size-3.5 shrink-0" />
              Starts {batch.startDate ?? 'soon'}
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <BookOpen className="size-3.5 shrink-0" />
              {batch.readingDaysPerWeek} days/week
            </span>
            <span className="col-span-2 flex items-center gap-1.5 truncate">
              <Users className="size-3.5 shrink-0" />
              {batch.enrolled} of {batch.maxMembers} taken
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Progress
            value={(batch.enrolled / batch.maxMembers) * 100}
            className="h-1.5"
          />

          <Button asChild className="w-full">
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
        </div>
      </CardContent>
    </Card>
  );
}
