'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  Send,
  UserX,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { PageHeader } from '@/components/shared/page-layout';
import { RoleChangeDialog } from './role-change-dialog';
import { UserDetailPanel } from './user-detail-panel';
import { fetchUserDetailsAction } from '@/actions/user-management';
import type {
  ListUsersResult,
  UserDetails,
  UserListItem,
} from '@/lib/services/admin/user-management';

export type UserManagementScopeOptions = {
  batches: { id: string; name: string }[];
  paceGroups: {
    id: string;
    name: string;
    batchId: string;
    batchName: string;
  }[];
};

function formatDisplayDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(d);
}

function RoleBadge({ role, isSuper }: { role: string; isSuper: boolean }) {
  if (isSuper) {
    return (
      <Badge variant="default" className="bg-gold text-gold-foreground">
        Super Admin
      </Badge>
    );
  }
  if (role === 'batch_admin') {
    return (
      <Badge variant="default" className="bg-teal text-teal-foreground">
        Batch Admin
      </Badge>
    );
  }
  if (role === 'pace_admin') {
    return (
      <Badge
        variant="secondary"
        className="border-teal/30 bg-teal/10 text-teal"
      >
        Pace Admin
      </Badge>
    );
  }
  return <Badge variant="outline">Member</Badge>;
}

export function UserManagementView({
  initialData,
  scopeOptions,
  initialUserDetails,
}: {
  initialData: ListUsersResult;
  scopeOptions: UserManagementScopeOptions;
  initialUserDetails: UserDetails | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Current query params
  const currentQuery = searchParams.get('q') || '';
  const currentRole = searchParams.get('role') || 'all';
  const currentBatchId = searchParams.get('batchId') || '';
  const currentPaceGroupId = searchParams.get('paceGroupId') || '';
  const currentTelegram = searchParams.get('telegram') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;
  const currentPageSize = Number(searchParams.get('pageSize')) || 20;
  const currentUserIdParam = searchParams.get('userId');

  const [prevQuery, setPrevQuery] = React.useState(currentQuery);
  const [searchInput, setSearchInput] = React.useState(currentQuery);

  if (prevQuery !== currentQuery) {
    setPrevQuery(currentQuery);
    setSearchInput(currentQuery);
  }

  const [selectedUserDetails, setSelectedUserDetails] =
    React.useState<UserDetails | null>(initialUserDetails);
  const [isDetailOpen, setIsDetailOpen] = React.useState(
    Boolean(initialUserDetails || currentUserIdParam),
  );
  const [isRoleDialogOpen, setIsRoleDialogOpen] = React.useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);
  const [isNavigating, startTransition] = useTransition();

  // Update URL helper
  const updateQueryParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      // Reset page to 1 if search or filters change (unless page is explicitly updated)
      if (!('page' in updates)) {
        params.delete('page');
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, pathname, router],
  );

  // Handle live search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentQuery) {
        updateQueryParams({ q: searchInput.trim() || null });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, currentQuery, updateQueryParams]);

  // Handle row click to open detail panel
  async function handleRowClick(userItem: UserListItem) {
    updateQueryParams({ userId: userItem.id });
    setIsDetailOpen(true);
    setIsLoadingDetails(true);

    try {
      const result = await fetchUserDetailsAction(userItem.id);
      if (result.ok && result.data) {
        setSelectedUserDetails(result.data);
      }
    } finally {
      setIsLoadingDetails(false);
    }
  }

  function handleDetailOpenChange(open: boolean) {
    setIsDetailOpen(open);
    if (!open) {
      updateQueryParams({ userId: null });
    }
  }

  async function refreshCurrentUserDetails() {
    if (selectedUserDetails?.profile.id) {
      const result = await fetchUserDetailsAction(
        selectedUserDetails.profile.id,
      );
      if (result.ok && result.data) {
        setSelectedUserDetails(result.data);
      }
    }
    // Also trigger router refresh to re-fetch the paginated list
    router.refresh();
  }

  // Active filter chips detection
  const activeChips = React.useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (currentQuery) {
      chips.push({
        key: 'q',
        label: `Search: "${currentQuery}"`,
        onRemove: () => {
          setSearchInput('');
          updateQueryParams({ q: null });
        },
      });
    }

    if (currentRole && currentRole !== 'all') {
      const roleLabels: Record<string, string> = {
        super_admin: 'Super Admin',
        batch_admin: 'Batch Admin',
        pace_admin: 'Pace Admin',
        member: 'Member',
      };
      chips.push({
        key: 'role',
        label: `Role: ${roleLabels[currentRole] || currentRole}`,
        onRemove: () => updateQueryParams({ role: null }),
      });
    }

    if (currentBatchId) {
      const batch = scopeOptions.batches.find((b) => b.id === currentBatchId);
      chips.push({
        key: 'batchId',
        label: `Batch: ${batch?.name || currentBatchId}`,
        onRemove: () => updateQueryParams({ batchId: null }),
      });
    }

    if (currentPaceGroupId) {
      const group = scopeOptions.paceGroups.find(
        (g) => g.id === currentPaceGroupId,
      );
      chips.push({
        key: 'paceGroupId',
        label: `Group: ${group?.name || currentPaceGroupId}`,
        onRemove: () => updateQueryParams({ paceGroupId: null }),
      });
    }

    if (currentTelegram && currentTelegram !== 'all') {
      chips.push({
        key: 'telegram',
        label: `Telegram: ${currentTelegram === 'linked' ? 'Linked' : 'Unlinked'}`,
        onRemove: () => updateQueryParams({ telegram: null }),
      });
    }

    return chips;
  }, [
    currentQuery,
    currentRole,
    currentBatchId,
    currentPaceGroupId,
    currentTelegram,
    scopeOptions,
  ]);

  function handleClearAllFilters() {
    setSearchInput('');
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Administration"
        title="User Management"
        description="Find users across the platform, inspect their responsibilities, change roles, and review audit history."
      />

      {/* Search and Filters Bar */}
      <Card className="card-soft">
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, Telegram..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Role Filter */}
            <div>
              <Select
                value={currentRole}
                onValueChange={(val) =>
                  updateQueryParams({ role: val || 'all' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="batch_admin">Batch Admin</SelectItem>
                  <SelectItem value="pace_admin">Pace Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Batch Filter */}
            <div>
              <Select
                value={currentBatchId || 'all'}
                onValueChange={(val) =>
                  updateQueryParams({
                    batchId: !val || val === 'all' ? null : val,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {scopeOptions.batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pace Group Filter */}
            <div>
              <Select
                value={currentPaceGroupId || 'all'}
                onValueChange={(val) =>
                  updateQueryParams({
                    paceGroupId: !val || val === 'all' ? null : val,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Pace Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pace Groups</SelectItem>
                  {scopeOptions.paceGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.batchName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Telegram Status Filter */}
            <div>
              <Select
                value={currentTelegram}
                onValueChange={(val) =>
                  updateQueryParams({ telegram: val || 'all' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Telegram status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Telegram</SelectItem>
                  <SelectItem value="linked">Telegram Linked</SelectItem>
                  <SelectItem value="unlinked">Telegram Unlinked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-xs font-medium text-muted-foreground">
                Active filters:
              </span>
              {activeChips.map((chip) => (
                <Badge
                  key={chip.key}
                  variant="secondary"
                  className="flex items-center gap-1.5 py-1 text-xs"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`Remove filter ${chip.label}`}
                    className="rounded-full hover:bg-surface-3 p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearAllFilters}
                className="h-6 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                Reset all
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="card-soft overflow-hidden">
        <div className="relative min-w-full overflow-x-auto">
          {isNavigating ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-xs">
              <span className="text-sm font-medium text-muted-foreground">
                Loading users...
              </span>
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Administrative Scope</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-48 text-center text-sm text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserX className="size-8 text-muted-foreground" />
                      <p className="font-medium text-foreground">
                        No users match the selected criteria.
                      </p>
                      {activeChips.length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearAllFilters}
                        >
                          Clear all filters
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                initialData.users.map((u) => (
                  <TableRow
                    key={u.id}
                    onClick={() => handleRowClick(u)}
                    className="cursor-pointer transition-colors hover:bg-surface-2"
                  >
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} isSuper={u.isSuperAdmin} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {u.scopeSummary.summaryText}
                    </TableCell>
                    <TableCell>
                      {u.telegramLinked ? (
                        <span className="inline-flex items-center gap-1 text-xs text-teal">
                          <Send className="size-3" />@{u.telegramUsername}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Unlinked
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDisplayDate(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing {initialData.users.length} of {initialData.total} users
            </span>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <span>Page size:</span>
              <Select
                value={String(currentPageSize)}
                onValueChange={(val) =>
                  updateQueryParams({ pageSize: val || '20', page: '1' })
                }
              >
                <SelectTrigger className="h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {initialData.page} of {initialData.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="size-8 p-0"
                disabled={currentPage <= 1}
                onClick={() =>
                  updateQueryParams({ page: String(currentPage - 1) })
                }
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="size-8 p-0"
                disabled={currentPage >= initialData.totalPages}
                onClick={() =>
                  updateQueryParams({ page: String(currentPage + 1) })
                }
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* User Detail Panel (Slide-over) */}
      <UserDetailPanel
        open={isDetailOpen}
        onOpenChange={handleDetailOpenChange}
        userDetails={selectedUserDetails}
        isLoading={isLoadingDetails}
        onChangeRoleClick={() => setIsRoleDialogOpen(true)}
      />

      {/* Role Change Confirmation Dialog */}
      {selectedUserDetails ? (
        <RoleChangeDialog
          key={`${selectedUserDetails.profile.id}:${isRoleDialogOpen}`}
          open={isRoleDialogOpen}
          onOpenChange={setIsRoleDialogOpen}
          userDetails={selectedUserDetails}
          batches={scopeOptions.batches}
          paceGroups={scopeOptions.paceGroups}
          onRoleChanged={refreshCurrentUserDetails}
        />
      ) : null}
    </div>
  );
}
