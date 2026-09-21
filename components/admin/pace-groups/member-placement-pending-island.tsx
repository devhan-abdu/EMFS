'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PendingMoveRequestsPanel } from './pending-move-requests-panel';
import type { PendingMoveRequestItem } from '@/lib/services/pace-groups/placement';

export function MemberPlacementPendingIsland({
  batchId,
  initialRequests,
}: {
  batchId: string;
  initialRequests: PendingMoveRequestItem[];
}) {
  const [showPanel, setShowPanel] = React.useState(false);

  if (initialRequests.length === 0) return null;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {initialRequests.length} pending pace group move request
                {initialRequests.length === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-muted-foreground">
                Members have submitted requests to change their assigned pace
                group.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={showPanel ? 'outline' : 'default'}
            onClick={() => setShowPanel((prev) => !prev)}
          >
            {showPanel ? 'Hide requests' : 'Review requests'}
          </Button>
        </CardContent>
      </Card>

      {showPanel && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold text-foreground">
              Pending move requests
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPanel(false)}
            >
              Close
            </Button>
          </div>
          <PendingMoveRequestsPanel
            batchId={batchId}
            initialRequests={initialRequests}
          />
        </div>
      )}
    </div>
  );
}
