'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, UserPlus, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PlacementAssignDialog,
  type PlacementDialogTarget,
} from './placement-assign-dialog';
import { BulkPlacementDialog } from './bulk-placement-dialog';
import type { BatchRosterMember } from '@/lib/services/pace-groups/placement';
import type { PaceGroupWithAdmins } from './types';

export function MemberRosterTable({
  batchId,
  members,
  paceGroups,
  groupMemberCounts,
}: {
  batchId: string;
  members: BatchRosterMember[];
  paceGroups: PaceGroupWithAdmins[];
  groupMemberCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [singleTarget, setSingleTarget] =
    React.useState<PlacementDialogTarget | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);

  const activeGroups = paceGroups.filter((g) => !g.archived);
  const selectedMembers = members.filter((m) => selectedIds.has(m.profileId));

  const allSelected =
    members.length > 0 && members.every((m) => selectedIds.has(m.profileId));
  const someSelected =
    members.some((m) => selectedIds.has(m.profileId)) && !allSelected;

  function handleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        members.forEach((m) => next.delete(m.profileId));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        members.forEach((m) => next.add(m.profileId));
        return next;
      });
    }
  }

  function handleToggleMember(profileId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center">
        <p className="font-display text-lg font-semibold text-foreground">
          No matching members found
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting your search query or filter options.
        </p>
      </div>
    );
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/10 p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {selectedIds.size}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {selectedIds.size} selected
            </span>
            {!allSelected && members.length > selectedIds.size && (
              <Button
                variant="link"
                size="sm"
                onClick={handleSelectAll}
                className="h-auto p-0 text-xs font-medium text-primary"
              >
                Select all {members.length} filtered
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
            <Button
              size="sm"
              onClick={() => setBulkOpen(true)}
              className="gap-2"
            >
              <Users className="size-4" />
              Assign to pace group
            </Button>
          </div>
        </div>
      )}

      <Card className="card-soft hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
              <TableHead className="w-12 pl-4">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all filtered members"
                />
              </TableHead>
              <TableHead className="py-4">Member</TableHead>
              <TableHead>Pace preference</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Current pace group</TableHead>
              <TableHead className="pr-6 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelected = selectedIds.has(member.profileId);
              const isPlaced = member.placementStatus === 'placed';

              return (
                <TableRow
                  key={member.profileId}
                  className={`hover:bg-accent/40 ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        handleToggleMember(member.profileId)
                      }
                      aria-label={`Select ${member.name}`}
                    />
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="font-medium text-foreground">{member.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{member.email}</span>
                      {member.telegramUsername && (
                        <span>· @{member.telegramUsername}</span>
                      )}
                      {member.phoneNumber && (
                        <span>· {member.phoneNumber}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.pacePreference ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        Prefers {member.pacePreference} p/d
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not collected
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isPlaced ? 'default' : 'outline'}
                      className={
                        isPlaced
                          ? 'border-teal/30 bg-teal/15 text-teal-foreground'
                          : 'bg-accent/50 text-muted-foreground'
                      }
                    >
                      {isPlaced ? 'Placed' : 'Awaiting placement'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.paceGroupName ? (
                      <span className="text-sm font-medium text-foreground">
                        {member.paceGroupName}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() =>
                        setSingleTarget({
                          member,
                          mode: isPlaced ? 'move' : 'assign',
                        })
                      }
                    >
                      {isPlaced ? (
                        <>
                          <ArrowRightLeft className="size-3.5" />
                          Move group
                        </>
                      ) : (
                        <>
                          <UserPlus className="size-3.5" />
                          Place in group
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-4 md:hidden">
        {members.map((member) => {
          const isSelected = selectedIds.has(member.profileId);
          const isPlaced = member.placementStatus === 'placed';

          return (
            <Card
              key={member.profileId}
              className={`card-soft transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : ''}`}
            >
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        handleToggleMember(member.profileId)
                      }
                      className="mt-2"
                      aria-label={`Select ${member.name}`}
                    />
                    <div>
                      <p className="font-medium text-foreground">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                      {member.telegramUsername && (
                        <p className="text-xs text-muted-foreground">
                          @{member.telegramUsername}
                        </p>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant={isPlaced ? 'default' : 'outline'}
                    className={`shrink-0 text-xs ${
                      isPlaced
                        ? 'border-teal/30 bg-teal/15 text-teal-foreground'
                        : 'bg-accent/50 text-muted-foreground'
                    }`}
                  >
                    {isPlaced ? 'Placed' : 'Awaiting'}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">
                      Current group:{' '}
                    </span>
                    <span className="font-medium text-foreground">
                      {member.paceGroupName ?? 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Preference: </span>
                    <span className="font-medium text-foreground">
                      {member.pacePreference
                        ? `${member.pacePreference} p/d`
                        : 'None'}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() =>
                    setSingleTarget({
                      member,
                      mode: isPlaced ? 'move' : 'assign',
                    })
                  }
                >
                  {isPlaced ? (
                    <>
                      <ArrowRightLeft className="size-3.5" />
                      Move group
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5" />
                      Place in group
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PlacementAssignDialog
        open={singleTarget !== null}
        onOpenChange={(open) => !open && setSingleTarget(null)}
        batchId={batchId}
        target={singleTarget}
        paceGroups={activeGroups}
        groupMemberCounts={groupMemberCounts}
        onSuccess={() => {
          setSingleTarget(null);
          router.refresh();
        }}
      />

      <BulkPlacementDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        batchId={batchId}
        selectedMembers={selectedMembers}
        paceGroups={activeGroups}
        groupMemberCounts={groupMemberCounts}
        onSuccess={() => {
          setBulkOpen(false);
          setSelectedIds(new Set());
          router.refresh();
        }}
      />
    </>
  );
}
