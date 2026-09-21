'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MemberPlacementFilters } from './member-placement-filters';
import { MemberRosterTable } from './member-roster-table';
import { PaceGroupFormDialog } from './pace-group-form-dialog';
import type { BatchRosterSummary } from '@/lib/services/pace-groups/placement';
import type { PaceGroupWithAdmins } from './types';

/**
 * Client island for membership filters, roster selection, and placement dialogs.
 * Roster data is filtered on the server from URL search params.
 */
export function MemberPlacementSection({
  batchId,
  batchName,
  paceGroups,
  initialRoster,
  totalMemberCount,
  groupMemberCounts,
}: {
  batchId: string;
  batchName: string;
  paceGroups: PaceGroupWithAdmins[];
  initialRoster: BatchRosterSummary;
  /** Unfiltered batch member count (for filter chrome). */
  totalMemberCount: number;
  /** Placed counts per pace group across the full roster (not filter-scoped). */
  groupMemberCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);

  const activeGroups = paceGroups.filter((g) => !g.archived);
  const members = initialRoster.members;

  if (activeGroups.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-4 rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <Layers className="size-6" />
          </div>
          <div className="space-y-2">
            <p className="font-display text-xl font-semibold text-foreground">
              Create a pace group before placing members
            </p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              This batch currently has no active pace groups. You must create at
              least one pace group in {batchName} before members can be assigned
              or moved.
            </p>
          </div>
          <Button onClick={() => setCreateGroupOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Create pace group
          </Button>
        </div>

        <PaceGroupFormDialog
          open={createGroupOpen}
          onOpenChange={setCreateGroupOpen}
          batchId={batchId}
          initial={null}
          onSuccess={() => {
            setCreateGroupOpen(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MemberPlacementFilters
        filteredCount={members.length}
        totalCount={totalMemberCount}
      />

      <MemberRosterTable
        batchId={batchId}
        members={members}
        paceGroups={activeGroups}
        groupMemberCounts={groupMemberCounts}
      />
    </div>
  );
}
