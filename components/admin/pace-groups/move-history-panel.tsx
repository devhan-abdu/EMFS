'use client';

import * as React from 'react';
import { ArrowRight, History, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MoveHistoryResult } from '@/lib/services/pace-groups/placement';

export function MoveHistoryPanel({
  _batchId,
  initialHistory,
}: {
  _batchId?: string;
  initialHistory: MoveHistoryResult;
  batchId?: string;
}) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 15;

  const allItems = initialHistory.items;

  // Filter items by search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.memberName.toLowerCase().includes(q) ||
        item.memberEmail.toLowerCase().includes(q) ||
        item.toPaceGroupName.toLowerCase().includes(q) ||
        (item.fromPaceGroupName &&
          item.fromPaceGroupName.toLowerCase().includes(q)) ||
        (item.movedByName && item.movedByName.toLowerCase().includes(q)) ||
        item.moveReason.toLowerCase().includes(q),
    );
  }, [allItems, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / itemsPerPage),
  );
  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  function handlePageChange(page: number) {
    setCurrentPage(page);
  }

  if (allItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center space-y-2">
        <History className="mx-auto size-8 text-muted-foreground opacity-60" />
        <p className="font-display text-lg font-semibold text-foreground">
          No move history yet
        </p>
        <p className="text-sm text-muted-foreground">
          When members are placed in or moved between pace groups, audit records
          will be logged here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search member, group, or admin..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {filteredItems.length} total event
          {filteredItems.length === 1 ? '' : 's'} recorded
        </p>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center">
          <p className="font-display text-lg font-semibold text-foreground">
            No matching move records
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search query.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="card-soft hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
                  <TableHead className="py-4 pl-6">Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Move details</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="pr-6">Moved by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => {
                  const isInitial = !item.fromPaceGroupId;
                  const dateFormatted = new Date(
                    item.moveDate,
                  ).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <TableRow key={item.id} className="hover:bg-accent/40">
                      <TableCell className="py-4 pl-6 font-mono text-xs text-muted-foreground">
                        {dateFormatted}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {item.memberName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.memberEmail}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {isInitial ? (
                            <Badge
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              Initial placement
                            </Badge>
                          ) : (
                            <span className="font-medium text-foreground">
                              {item.fromPaceGroupName}
                            </span>
                          )}
                          <ArrowRight className="size-3.5 text-muted-foreground" />
                          <span className="font-medium text-primary">
                            {item.toPaceGroupName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-foreground font-medium">
                          {item.moveReason}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground">
                            Note: {item.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-sm text-muted-foreground">
                        {item.movedByName ?? 'System / Admin'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Card List */}
          <div className="space-y-4 md:hidden">
            {paginatedItems.map((item) => {
              const isInitial = !item.fromPaceGroupId;
              const dateFormatted = new Date(item.moveDate).toLocaleDateString(
                undefined,
                {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                },
              );

              return (
                <Card key={item.id} className="card-soft">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{dateFormatted}</span>
                      <span>By: {item.movedByName ?? 'Admin'}</span>
                    </div>

                    <div>
                      <p className="font-medium text-foreground">
                        {item.memberName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.memberEmail}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm pt-2">
                      {isInitial ? (
                        <Badge variant="outline" className="text-xs">
                          Initial
                        </Badge>
                      ) : (
                        <span className="font-medium text-foreground">
                          {item.fromPaceGroupName}
                        </span>
                      )}
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <span className="font-medium text-primary">
                        {item.toPaceGroupName}
                      </span>
                    </div>

                    <div className="border-t border-border pt-2 text-xs">
                      <p className="font-medium text-foreground">
                        {item.moveReason}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
