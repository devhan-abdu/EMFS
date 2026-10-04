import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPendingMoveRequests } from '@/lib/services/pace-groups/placement';
import { MemberPlacementPendingIsland } from './member-placement-pending-island';

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

async function PendingMovesLoader({ batchId }: { batchId: string }) {
  const requests = await getPendingMoveRequests(batchId);
  return (
    <MemberPlacementPendingIsland
      batchId={batchId}
      initialRequests={requests}
    />
  );
}

function MoveHistoryLinkCard({ batchId }: { batchId: string }) {
  return (
    <Card className="card-soft">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">Move history</p>
          <p className="text-sm text-muted-foreground">
            Review prior placement changes and audit events in the dedicated
            history route.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/b/${batchId}/history`}>Open move history</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function MemberPlacementSecondaryPanels({
  batchId,
}: {
  batchId: string;
}) {
  return (
    <div className="space-y-6">
      <Suspense
        fallback={<PanelSkeleton label="Loading pending move requests…" />}
      >
        <PendingMovesLoader batchId={batchId} />
      </Suspense>
      <MoveHistoryLinkCard batchId={batchId} />
    </div>
  );
}
