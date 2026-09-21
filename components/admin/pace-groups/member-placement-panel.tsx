import { Suspense } from 'react';

import {
  getBatchRoster,
  getPaceGroupMemberCounts,
  type BatchRosterSummary,
} from '@/lib/services/pace-groups/placement';
import type {
  PlacementStatusFilter,
  PacePreferenceFilter,
} from '@/lib/validations/placement';
import { MemberPlacementSection } from './member-placement-section';
import { MemberPlacementSecondaryPanels } from './member-placement-secondary-panels';
import type { PaceGroupWithAdmins } from './types';

function RosterSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded-2xl bg-surface-container" />
      <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />
    </div>
  );
}

function parseRosterFilters(searchParams: {
  q?: string;
  search?: string;
  status?: string;
  preference?: string;
  pref?: string;
}) {
  const statusRaw = searchParams.status;
  const placementStatus: PlacementStatusFilter =
    statusRaw === 'placed' || statusRaw === 'unplaced' ? statusRaw : 'all';

  const prefRaw = searchParams.preference ?? searchParams.pref ?? 'all';
  const pacePreference: PacePreferenceFilter = (
    ['all', '5', '10', '20', '40'] as const
  ).includes(prefRaw as PacePreferenceFilter)
    ? (prefRaw as PacePreferenceFilter)
    : 'all';

  const searchRaw = (searchParams.q ?? searchParams.search ?? '').trim();

  return {
    placementStatus,
    pacePreference,
    search: searchRaw.length > 0 ? searchRaw : undefined,
  };
}

async function MemberPlacementRosterLoader({
  batchId,
  batchName,
  paceGroups,
  totalMemberCount,
  searchParams,
}: {
  batchId: string;
  batchName: string;
  paceGroups: PaceGroupWithAdmins[];
  totalMemberCount: number;
  searchParams: {
    q?: string;
    search?: string;
    status?: string;
    preference?: string;
    pref?: string;
  };
}) {
  const filters = parseRosterFilters(searchParams);

  const [initialRoster, groupMemberCounts]: [
    BatchRosterSummary,
    Record<string, number>,
  ] = await Promise.all([
    getBatchRoster({
      batchId,
      placementStatus: filters.placementStatus,
      pacePreference: filters.pacePreference,
      search: filters.search,
    }),
    getPaceGroupMemberCounts(batchId),
  ]);

  return (
    <MemberPlacementSection
      batchId={batchId}
      batchName={batchName}
      paceGroups={paceGroups}
      initialRoster={initialRoster}
      totalMemberCount={totalMemberCount}
      groupMemberCounts={groupMemberCounts}
    />
  );
}

/**
 * Server composition for the Members & placements tab:
 * streaming secondary panels + URL-filtered roster island.
 */
export function MemberPlacementPanel({
  batchId,
  batchName,
  paceGroups,
  totalMemberCount,
  searchParams,
}: {
  batchId: string;
  batchName: string;
  paceGroups: PaceGroupWithAdmins[];
  totalMemberCount: number;
  searchParams: {
    q?: string;
    search?: string;
    status?: string;
    preference?: string;
    pref?: string;
  };
}) {
  return (
    <div className="space-y-6">
      <MemberPlacementSecondaryPanels batchId={batchId} />
      <Suspense fallback={<RosterSkeleton />}>
        <MemberPlacementRosterLoader
          batchId={batchId}
          batchName={batchName}
          paceGroups={paceGroups}
          totalMemberCount={totalMemberCount}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
