'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  History,
  Layers,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PendingMoveRequestsPanel } from './pending-move-requests-panel';
import { MoveHistoryPanel } from './move-history-panel';
import { PaceGroupFormDialog } from './pace-group-form-dialog';
import type {
  BatchRosterSummary,
  MoveHistoryResult,
  PendingMoveRequestItem,
} from '@/lib/services/pace-groups/placement';
import type { PaceGroupWithAdmins } from './types';

export function MemberPlacementSection({
  batchId,
  batchName,
  paceGroups,
  initialRoster,
  initialPendingRequests = [],
  initialHistory,
}: {
  batchId: string;
  batchName: string;
  paceGroups: PaceGroupWithAdmins[];
  initialRoster: BatchRosterSummary;
  initialPendingRequests?: PendingMoveRequestItem[];
  initialHistory?: MoveHistoryResult;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial filter values from URL parameters if present
  const urlStatus = searchParams?.get('status');
  const urlPref = searchParams?.get('preference') ?? searchParams?.get('pref');
  const urlSearch = searchParams?.get('q') ?? searchParams?.get('search');

  // Filter state
  const [searchQuery, setSearchQuery] = React.useState<string>(
    () => urlSearch ?? '',
  );
  const [placementFilter, setPlacementFilter] = React.useState<
    'all' | 'placed' | 'unplaced'
  >(() => {
    if (urlStatus === 'placed' || urlStatus === 'unplaced') return urlStatus;
    return 'all';
  });
  const [pacePrefFilter, setPacePrefFilter] = React.useState<string>(() => {
    if (urlPref && ['5', '10', '20', '40'].includes(urlPref)) return urlPref;
    return 'all';
  });

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Dialog states
  const [singleTarget, setSingleTarget] =
    React.useState<PlacementDialogTarget | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  const [showPendingPanel, setShowPendingPanel] = React.useState(false);
  const [showHistorySection, setShowHistorySection] = React.useState(false);

  const activeGroups = paceGroups.filter((g) => !g.archived);

  // Sync with live initial roster
  const members = initialRoster.members;

  // Sync state to URL search parameters without full page reloads
  const syncFiltersToUrl = React.useCallback(
    (status: string, pref: string, query: string) => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);

      if (status && status !== 'all') {
        params.set('status', status);
      } else {
        params.delete('status');
      }

      if (pref && pref !== 'all') {
        params.set('preference', pref);
      } else {
        params.delete('preference');
        params.delete('pref');
      }

      if (query && query.trim().length > 0) {
        params.set('q', query.trim());
      } else {
        params.delete('q');
        params.delete('search');
      }

      const qs = params.toString();
      const newUrl = qs ? `${pathname}?${qs}` : pathname;
      window.history.replaceState(null, '', newUrl);
    },
    [pathname],
  );

  function handleStatusFilterChange(val: 'all' | 'placed' | 'unplaced') {
    setPlacementFilter(val);
    syncFiltersToUrl(val, pacePrefFilter, searchQuery);
  }

  function handlePrefFilterChange(val: string | null) {
    const nextVal = val ?? 'all';
    setPacePrefFilter(nextVal);
    syncFiltersToUrl(placementFilter, nextVal, searchQuery);
  }

  function handleSearchChange(query: string) {
    setSearchQuery(query);
    syncFiltersToUrl(placementFilter, pacePrefFilter, query);
  }

  function handleResetFilters() {
    setSearchQuery('');
    setPlacementFilter('all');
    setPacePrefFilter('all');
    syncFiltersToUrl('all', 'all', '');
  }

  // Filter members on client with AND combination
  const filteredMembers = React.useMemo(() => {
    return members.filter((member) => {
      // 1. Placement status filter (AND)
      if (placementFilter === 'placed' && member.placementStatus !== 'placed') {
        return false;
      }
      if (
        placementFilter === 'unplaced' &&
        member.placementStatus !== 'unplaced'
      ) {
        return false;
      }

      // 2. Pace preference filter from applications.paceGroup (AND)
      if (pacePrefFilter !== 'all') {
        if (member.pacePreference !== pacePrefFilter) {
          return false;
        }
      }

      // 3. Search query filter (AND)
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = member.name.toLowerCase().includes(query);
        const matchEmail = member.email.toLowerCase().includes(query);
        const matchTelegram = member.telegramUsername
          ?.toLowerCase()
          .includes(query);
        const matchPhone = member.phoneNumber?.includes(query);
        const matchGroup = member.paceGroupName?.toLowerCase().includes(query);

        if (
          !matchName &&
          !matchEmail &&
          !matchTelegram &&
          !matchPhone &&
          !matchGroup
        ) {
          return false;
        }
      }

      return true;
    });
  }, [members, placementFilter, pacePrefFilter, searchQuery]);

  // Active member counts per pace group in this batch
  const groupMemberCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of members) {
      if (m.paceGroupId && m.placementStatus === 'placed') {
        counts[m.paceGroupId] = (counts[m.paceGroupId] ?? 0) + 1;
      }
    }
    return counts;
  }, [members]);

  // Selected member objects (preserved even if filters change)
  const selectedMembers = React.useMemo(() => {
    return members.filter((m) => selectedIds.has(m.profileId));
  }, [members, selectedIds]);

  // Selection helpers: operates strictly on currently filtered members
  const allFilteredSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => selectedIds.has(m.profileId));

  const someFilteredSelected =
    filteredMembers.some((m) => selectedIds.has(m.profileId)) &&
    !allFilteredSelected;

  function handleSelectAllFiltered() {
    if (allFilteredSelected) {
      // Deselect only currently filtered members
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredMembers.forEach((m) => next.delete(m.profileId));
        return next;
      });
    } else {
      // Select ONLY members currently matching active filters (NOT the entire unfiltered roster)
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredMembers.forEach((m) => next.add(m.profileId));
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

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  // 1. EMPTY BATCH BLOCKING STATE (0 pace groups)
  if (activeGroups.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center space-y-4">
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
      {/* Pending Move Requests Notice Banner (if any) */}
      {initialPendingRequests.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {initialPendingRequests.length} pending pace group move
                  request{initialPendingRequests.length === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Members have submitted requests to change their assigned pace
                  group.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={showPendingPanel ? 'outline' : 'default'}
              onClick={() => setShowPendingPanel((prev) => !prev)}
            >
              {showPendingPanel ? 'Hide requests' : 'Review requests'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Move Requests Collapsible Sub-Panel */}
      {showPendingPanel && initialPendingRequests.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold text-foreground">
              Pending move requests
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPendingPanel(false)}
            >
              Close
            </Button>
          </div>
          <PendingMoveRequestsPanel
            batchId={batchId}
            initialRequests={initialPendingRequests}
          />
        </div>
      )}

      {/* Summary Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="card-soft">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total enrolled
              </p>
              <p className="font-display text-2xl font-bold text-foreground">
                {initialRoster.totalMembers}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-foreground">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Placed in groups
              </p>
              <p className="font-display text-2xl font-bold text-foreground">
                {initialRoster.placedCount}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal/15 text-teal-foreground">
              <UserCheck className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Awaiting placement
              </p>
              <p className="font-display text-2xl font-bold text-foreground">
                {initialRoster.unplacedCount}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <UserPlus className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="card-soft">
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone, telegram..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
                aria-label="Search members"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div>
              <Select
                value={placementFilter}
                onValueChange={(v) =>
                  handleStatusFilterChange(v as 'all' | 'placed' | 'unplaced')
                }
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by placement status"
                >
                  <SelectValue placeholder="Placement status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unplaced">Unplaced</SelectItem>
                  <SelectItem value="placed">Placed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preference Filter */}
            <div>
              <Select
                value={pacePrefFilter}
                onValueChange={handlePrefFilterChange}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by page-size preference"
                >
                  <SelectValue placeholder="Preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All preferences</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="40">40</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filter Indicators & Reset */}
          {(searchQuery ||
            placementFilter !== 'all' ||
            pacePrefFilter !== 'all') && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Filter className="size-3.5" />
                <span>
                  Showing {filteredMembers.length} of {members.length} members
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-7 text-xs"
              >
                Reset filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky / Prominent Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/10 p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {selectedIds.size}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {selectedIds.size} selected
            </span>
            {!allFilteredSelected &&
              filteredMembers.length > selectedIds.size && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleSelectAllFiltered}
                  className="h-auto p-0 text-xs text-primary font-medium"
                >
                  Select all {filteredMembers.length} filtered
                </Button>
              )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClearSelection}>
              Clear selection
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkOpen(true)}
              className="gap-2"
            >
              <Users className="size-4" />
              Assign to pace group
            </Button>
          </div>
        </div>
      )}

      {/* Roster Display */}
      {filteredMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center">
          <p className="font-display text-lg font-semibold text-foreground">
            No matching members found
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search query or filter options.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="card-soft hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      checked={allFilteredSelected}
                      indeterminate={someFilteredSelected}
                      onCheckedChange={handleSelectAllFiltered}
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
                {filteredMembers.map((member) => {
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
                        <p className="font-medium text-foreground">
                          {member.name}
                        </p>
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
                          <Badge
                            variant="outline"
                            className="text-xs font-normal"
                          >
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
                              ? 'bg-teal/15 text-teal-foreground border-teal/30'
                              : 'bg-accent/50 text-muted-foreground'
                          }
                        >
                          {isPlaced ? 'Placed' : 'Awaiting placement'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.paceGroupName ? (
                          <span className="font-medium text-foreground text-sm">
                            {member.paceGroupName}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
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

          {/* Mobile Card List View */}
          <div className="space-y-4 md:hidden">
            {filteredMembers.map((member) => {
              const isSelected = selectedIds.has(member.profileId);
              const isPlaced = member.placementStatus === 'placed';

              return (
                <Card
                  key={member.profileId}
                  className={`card-soft transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : ''}`}
                >
                  <CardContent className="p-4 space-y-4">
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
                            ? 'bg-teal/15 text-teal-foreground border-teal/30'
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
                        <span className="text-muted-foreground">
                          Preference:{' '}
                        </span>
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
        </>
      )}

      {/* Collapsible Move History Subsection below Roster */}
      {initialHistory && (
        <Card className="card-soft overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-surface-container text-foreground">
                  <History className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Move history &amp; placement audit
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {initialHistory.total} historical placement and group change
                    event{initialHistory.total === 1 ? '' : 's'} recorded in
                    this batch.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistorySection((prev) => !prev)}
                className="gap-2"
              >
                {showHistorySection ? (
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

            {showHistorySection && (
              <div className="border-t border-border pt-4">
                <MoveHistoryPanel
                  batchId={batchId}
                  initialHistory={initialHistory}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Single Assign / Move Dialog */}
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

      {/* Bulk Placement Dialog */}
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
    </div>
  );
}
