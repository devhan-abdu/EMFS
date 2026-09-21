import { Suspense } from 'react';

import {
  getBatchMoveHistory,
  getPendingMoveRequests,
} from '@/lib/services/pace-groups/placement';
import { MemberPlacementHistoryIsland } from './member-placement-history-island';
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

async function MoveHistoryLoader({ batchId }: { batchId: string }) {
  const history = await getBatchMoveHistory({
    batchId,
    page: 1,
    limit: 20,
  });
  return (
    <MemberPlacementHistoryIsland batchId={batchId} initialHistory={history} />
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
      <Suspense fallback={<PanelSkeleton label="Loading move history…" />}>
        <MoveHistoryLoader batchId={batchId} />
      </Suspense>
    </div>
  );
}
