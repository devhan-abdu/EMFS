import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  BookOpen,
  Calendar,
  Clock,
  Coffee,
  Send,
  Sparkles,
} from 'lucide-react';

import { requireSession } from '@/lib/auth/authorize';
import { getMemberHomeState } from '@/lib/services/member/get-member-home-state';
import { PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TodayTaskCompleteButton } from '@/components/member/today-task-complete-button';

export const metadata: Metadata = {
  title: "Today's reading — EMFSC Book Shelf",
  description:
    "Your pages for today, your reading streak and this week's rhythm with your EMFSC pace group.",
  openGraph: {
    title: "Today's reading — EMFSC Book Shelf",
    description: "Today's pages, your streak and this week's reading rhythm.",
  },
};

export default async function MeHomePage() {
  let currentUser;
  try {
    currentUser = await requireSession();
  } catch {
    redirect('/signin?next=/me');
  }

  const state = await getMemberHomeState(currentUser.profile.id);

  switch (state.kind) {
    case 'no_batch':
      return (
        <div className="space-y-6">
          <PageHeader
            title="You're not in a batch yet"
            description="Browse open batches and apply to start reading with a circle."
          />
          <Button asChild>
            <Link href="/batches">Browse open batches</Link>
          </Button>
        </div>
      );

    case 'waitlisted':
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={state.batchName}
            title="You're on the waiting list"
          />
          <Card className="card-soft">
            <CardContent className="p-6 text-sm text-foreground">
              You&apos;re position{' '}
              <span className="font-semibold tabular-nums">
                {state.queuePosition}
              </span>{' '}
              in line. We&apos;ll notify you in-app when a seat opens.
            </CardContent>
          </Card>
        </div>
      );

    case 'applied':
      return (
        <div className="space-y-6">
          <PageHeader eyebrow={state.batchName} title="Application received" />
          <Card className="card-soft">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Your application is in. If a seat is available you&apos;ll get a
              Telegram bot link here to finish joining — no admin review needed.
            </CardContent>
          </Card>
        </div>
      );

    case 'rejected':
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={state.batchName}
            title="Application not accepted"
            description="This application wasn't accepted this time."
          />
          <Button asChild variant="outline">
            <Link href="/batches">Browse other open batches</Link>
          </Button>
        </div>
      );

    case 'approved_pending_handoff':
      return (
        <div className="space-y-6">
          <PageHeader eyebrow={state.batchName} title="One step left" />
          <Card className="card-soft border-l-4 border-l-gold bg-gold/10">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm font-medium text-foreground">
                You&apos;re approved for {state.batchName}!
              </p>
              <p className="text-sm text-muted-foreground">
                Open the Telegram bot to link your account and activate your
                membership.
              </p>
              {state.telegramStartLink ? (
                <Button asChild className="w-full">
                  <a
                    href={state.telegramStartLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Send className="size-4" />
                    Finish joining — open Telegram
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Contact your batch admin for a new handoff link.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );

    case 'active_awaiting_placement':
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={state.batchName}
            title="You are accepted into this batch. Your pace group will be assigned soon."
          />
          <Card className="card-soft">
            <CardContent className="p-6 text-sm text-muted-foreground">
              You are accepted into this batch. Your pace group will be assigned
              soon.
            </CardContent>
          </Card>
        </div>
      );

    case 'active_placed':
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={`${state.batchName} · ${state.paceGroupName}`}
            title={
              state.schedule.status === 'published'
                ? "Today's reading"
                : state.schedule.status === 'before_batch_start'
                  ? 'Batch starts soon'
                  : state.schedule.status === 'rest_day'
                    ? 'Rest day'
                    : state.schedule.status === 'no_published_task'
                      ? 'No task published yet'
                      : 'Curriculum complete'
            }
            description={
              state.schedule.status === 'published'
                ? `Day ${state.schedule.dayNumber} · ${state.paceGroupSize} pages/day`
                : state.schedule.status === 'before_batch_start'
                  ? `Reading begins on ${state.schedule.startDate ?? 'the announced start date'}.`
                  : state.schedule.status === 'rest_day'
                    ? 'Take time to catch up, reflect, or rest before the next reading day.'
                    : state.schedule.status === 'no_published_task'
                      ? "Your pace admin has not published today's reading assignment yet."
                      : 'You have completed all reading tasks for this book.'
            }
          />

          {state.schedule.status === 'published' && (
            <Card className="card-soft">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="size-4 text-primary" />
                      <p className="font-semibold text-foreground">
                        {state.schedule.book?.title ?? 'Curriculum Reading'}
                      </p>
                    </div>
                    {state.schedule.book?.author && (
                      <p className="text-xs text-muted-foreground">
                        by {state.schedule.book.author}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Pages</p>
                    <p className="font-display text-lg font-bold text-primary">
                      {state.schedule.task.startPage} –{' '}
                      {state.schedule.task.endPage}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {state.schedule.task.endPage -
                        state.schedule.task.startPage +
                        1}{' '}
                      pages
                    </p>
                  </div>
                </div>

                {state.schedule.task.content && (
                  <div className="rounded-xl bg-surface-container p-4 text-sm leading-relaxed text-foreground">
                    <p className="whitespace-pre-line">
                      {state.schedule.task.content}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    {state.schedule.isCompleted && (
                      <Badge
                        variant="outline"
                        className="text-xs font-normal border-teal/40 bg-teal/10 text-teal-foreground"
                      >
                        Completed today
                      </Badge>
                    )}
                  </div>
                  <TodayTaskCompleteButton
                    taskId={state.schedule.task.id}
                    initialCompleted={state.schedule.isCompleted}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {state.schedule.status === 'before_batch_start' && (
            <Card className="card-soft">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-foreground">
                  <Calendar className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    You are placed in {state.paceGroupName} (
                    {state.paceGroupSize} pages/day).
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The reading curriculum will unlock automatically on{' '}
                    {state.schedule.startDate ?? 'the start date'}.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {state.schedule.status === 'rest_day' && (
            <Card className="card-soft">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-foreground">
                  <Coffee className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Today is a scheduled rest day for your {state.paceGroupName}{' '}
                    group.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use this day to catch up on any missed pages or write your
                    weekly reflection.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {state.schedule.status === 'no_published_task' && (
            <Card className="card-soft">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-foreground">
                  <Clock className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    No reading task published for today yet.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your pace group admin will publish the daily reading pages
                    soon. Please check back later today.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {state.schedule.status === 'exhausted_curriculum' && (
            <Card className="card-soft">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-teal/15 text-teal-foreground">
                  <Sparkles className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Curriculum complete!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All assigned reading tasks have been completed. Check with
                    your batch admin for upcoming books.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
  }
}
