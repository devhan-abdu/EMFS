'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MoveHistoryPanel } from './move-history-panel';
import type { MoveHistoryResult } from '@/lib/services/pace-groups/placement';

export function MemberPlacementHistoryIsland({
  batchId,
  initialHistory,
}: {
  batchId: string;
  initialHistory: MoveHistoryResult;
}) {
  const [showHistory, setShowHistory] = React.useState(false);

  return (
    <Card className="card-soft overflow-hidden">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-foreground">
              <History className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Move history &amp; placement audit
              </h3>
              <p className="text-xs text-muted-foreground">
                {initialHistory.total} historical placement and group change
                event{initialHistory.total === 1 ? '' : 's'} recorded in this
                batch.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory((prev) => !prev)}
            className="gap-2"
          >
            {showHistory ? (
              <>
                <ChevronUp className="size-4" />
                Hide history
              </>
            ) : (
              <>
                <ChevronDown className="size-4" />
                View history ({initialHistory.total})
              </>
            )}
          </Button>
        </div>

        {showHistory && (
          <div className="border-t border-border pt-4">
            <MoveHistoryPanel
              batchId={batchId}
              initialHistory={initialHistory}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
