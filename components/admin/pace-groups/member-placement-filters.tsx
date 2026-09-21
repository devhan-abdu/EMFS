'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Filter, Search, X } from 'lucide-react';

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

const SEARCH_DEBOUNCE_MS = 300;

export type PlacementFilterStatus = 'all' | 'placed' | 'unplaced';

export type MemberPlacementFiltersProps = {
  filteredCount: number;
  totalCount: number;
};

export function MemberPlacementFilters({
  filteredCount,
  totalCount,
}: MemberPlacementFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlStatus = searchParams.get('status');
  const urlPref =
    searchParams.get('preference') ?? searchParams.get('pref') ?? 'all';
  const urlSearch = searchParams.get('q') ?? searchParams.get('search') ?? '';

  const placementFilter: PlacementFilterStatus =
    urlStatus === 'placed' || urlStatus === 'unplaced' ? urlStatus : 'all';
  const pacePrefFilter = ['5', '10', '20', '40'].includes(urlPref)
    ? urlPref
    : 'all';

  const [searchInput, setSearchInput] = React.useState(urlSearch);
  const debounceRef = React.useRef<number | null>(null);

  function writeParams(next: {
    status?: string;
    preference?: string;
    q?: string;
  }) {
    // Prefer live URL so debounced search commits don't clobber newer filter params
    const params = new URLSearchParams(
      typeof window !== 'undefined'
        ? window.location.search
        : searchParams.toString(),
    );

    if (next.status !== undefined) {
      if (next.status && next.status !== 'all') {
        params.set('status', next.status);
      } else {
        params.delete('status');
      }
    }

    if (next.preference !== undefined) {
      if (next.preference && next.preference !== 'all') {
        params.set('preference', next.preference);
      } else {
        params.delete('preference');
        params.delete('pref');
      }
    }

    if (next.q !== undefined) {
      const trimmed = next.q.trim();
      if (trimmed.length > 0) {
        params.set('q', trimmed);
      } else {
        params.delete('q');
        params.delete('search');
      }
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleSearchInputChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      writeParams({ q: value });
      debounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
  }

  React.useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    placementFilter !== 'all' ||
    pacePrefFilter !== 'all';

  return (
    <Card className="card-soft">
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone, telegram..."
              value={searchInput}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="pl-10"
              aria-label="Search members"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  if (debounceRef.current !== null) {
                    window.clearTimeout(debounceRef.current);
                    debounceRef.current = null;
                  }
                  setSearchInput('');
                  writeParams({ q: '' });
                }}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div>
            <Select
              value={placementFilter}
              onValueChange={(v) =>
                writeParams({
                  status: (v as PlacementFilterStatus) ?? 'all',
                })
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

          <div>
            <Select
              value={pacePrefFilter}
              onValueChange={(v) => writeParams({ preference: v ?? 'all' })}
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

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Filter className="size-3.5" />
              <span>
                Showing {filteredCount} of {totalCount} members
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (debounceRef.current !== null) {
                  window.clearTimeout(debounceRef.current);
                  debounceRef.current = null;
                }
                setSearchInput('');
                writeParams({ status: 'all', preference: 'all', q: '' });
              }}
              className="h-8 text-xs"
            >
              Reset filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
