'use client';

import { toast } from 'sonner';
import { BookOpen, CalendarDays } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { PaceGroupWithAdmins } from './types';

/**
 * UI-only preview. Today's page-target generator (module 03.4) isn't wired
 * to the backend yet — this shows the intended admin experience only.
 */
export function DailyTaskPanel({ groups }: { groups: PaceGroupWithAdmins[] }) {
  const activeGroups = groups.filter((g) => !g.archived);

  if (activeGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center">
        <p className="font-display text-lg font-semibold text-foreground">
          No pacing cursors yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cursors appear once this batch has at least one pace group.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Preview only — daily task publishing isn&apos;t wired to the backend
        yet.
      </p>
      {activeGroups.map((group) => {
        const canPublish = group.admins.some((a) => a.duty === 'daily_task');
        return (
          <Card key={group.id} className="card-soft">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    {group.name}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <BookOpen className="size-3.5" />
                    No book assigned yet
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!canPublish}
                  onClick={() =>
                    toast.success(
                      `Today's pages published for ${group.name} (preview only)`,
                    )
                  }
                >
                  <CalendarDays className="size-3.5" />
                  Publish today&apos;s pages
                </Button>
              </div>
              <span
                className={cn(
                  'inline-block rounded-full px-2 py-0.5 text-xs',
                  canPublish
                    ? 'bg-accent text-primary'
                    : 'bg-gold/20 text-gold-foreground',
                )}
              >
                {canPublish
                  ? 'Daily-task duty assigned'
                  : 'Nobody holds the daily-task duty yet'}
              </span>
              <Progress value={0} className="h-1.5" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
