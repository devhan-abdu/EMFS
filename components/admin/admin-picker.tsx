"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
  getPreviouslyAssignedBatchAdminsAction,
  searchProfilesAction,
} from "@/actions/user-search";
import type { ProfileSearchResult } from "@/lib/validations/user-search";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { X, Search, UserCheck, Users } from "lucide-react";

export type AdminPickerProps = {
  initialSelectedAdmins?: ProfileSearchResult[];
  error?: string;
  maxAdmins?: number;
};

export function AdminPicker({
  initialSelectedAdmins = [],
  error,
  maxAdmins = 3,
}: AdminPickerProps) {
  const [selectedAdmins, setSelectedAdmins] = useState<ProfileSearchResult[]>(
    initialSelectedAdmins,
  );
  const [previousAdmins, setPreviousAdmins] = useState<ProfileSearchResult[]>(
    [],
  );
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const latestQueryRef = useRef("");

  // Section A: previously assigned batch admins, loaded once on mount
  useEffect(() => {
    let isMounted = true;
    getPreviouslyAssignedBatchAdminsAction()
      .then((res) => {
        if (isMounted && res.ok) setPreviousAdmins(res.data);
      })
      .catch((err) => console.error("Failed to load previous admins:", err))
      .finally(() => {
        if (isMounted) setIsLoadingPrevious(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Section B: debounced search, excludes already-selected admins
  const runSearch = useDebouncedCallback((trimmed: string) => {
    latestQueryRef.current = trimmed;
    startSearchTransition(async () => {
      const excludeProfileIds = selectedAdmins.map((a) => a.profileId);
      const res = await searchProfilesAction({
        query: trimmed,
        excludeProfileIds,
      });

      if (latestQueryRef.current !== trimmed) return; // stale response, discard

      if (res.ok) {
        setSearchResults(res.data);
        setSearchError(null);
      } else {
        setSearchError(res.errors.formErrors[0] ?? "Search failed. Try again.");
      }
    });
  }, 300);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    runSearch(trimmed);
  }, [searchQuery, runSearch]);

  const selectedIds = new Set(selectedAdmins.map((a) => a.profileId));
  const isMaxReached = selectedAdmins.length >= maxAdmins;

  function toggleAdmin(person: ProfileSearchResult) {
    if (selectedIds.has(person.profileId)) {
      setSelectedAdmins((prev) =>
        prev.filter((a) => a.profileId !== person.profileId),
      );
    } else if (!isMaxReached) {
      setSelectedAdmins((prev) => [...prev, person]);
    }
  }

  function removeAdmin(profileId: string) {
    setSelectedAdmins((prev) => prev.filter((a) => a.profileId !== profileId));
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      {/* Header & limits description */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-semibold text-foreground">
            Batch Admins (1–3)
          </label>
          <p className="text-xs text-muted-foreground">
            Select 1 to 3 batch admins to manage registration, pace groups, and
            pacing.
          </p>
        </div>
        <span
          className={`text-xs font-medium ${
            selectedAdmins.length === 0 || selectedAdmins.length > maxAdmins ?
              "text-destructive"
            : "text-muted-foreground"
          }`}
        >
          {selectedAdmins.length} of {maxAdmins} selected
        </span>
      </div>

      {/* Hidden inputs — UUIDs travel via FormData, never rendered as visible text */}
      {selectedAdmins.map((admin) => (
        <input
          key={admin.profileId}
          type="hidden"
          name="adminIds"
          value={admin.profileId}
        />
      ))}

      {/* Selected admin chips */}
      {selectedAdmins.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Selected admins:
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedAdmins.map((admin) => (
              <div
                key={admin.profileId}
                className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm shadow-xs"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium text-foreground">
                    {admin.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {admin.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAdmin(admin.profileId)}
                  className="ml-1 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-hidden"
                  aria-label={`Remove ${admin.displayName}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section A: previously assigned batch admins */}
      <div className="space-y-2 border-t border-border pt-2">
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Previously assigned batch admins
          </h3>
        </div>

        {isLoadingPrevious ?
          <div className="space-y-2 py-2">
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/60" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/60" />
          </div>
        : previousAdmins.length === 0 ?
          <p className="py-2 text-xs text-muted-foreground">
            No previously assigned batch admins found. Search all users below.
          </p>
        : <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {previousAdmins.map((admin) => {
              const isSelected = selectedIds.has(admin.profileId);
              const isDisabled = !isSelected && isMaxReached;
              return (
                <div
                  key={admin.profileId}
                  onClick={() => !isDisabled && toggleAdmin(admin)}
                  className={`flex items-center justify-between rounded-md p-2 text-sm transition-colors ${
                    isDisabled ?
                      "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-secondary"
                  } ${isSelected ? "bg-secondary font-medium" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={() => !isDisabled && toggleAdmin(admin)}
                      aria-label={`Select ${admin.displayName}`}
                    />
                    <div className="flex flex-col text-left">
                      <span className="text-foreground">
                        {admin.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {admin.email}
                        {admin.adminOfBatches?.length ?
                          <>
                            {" "}
                            · Admin of{" "}
                            {admin.adminOfBatches.map((b) => b.name).join(", ")}
                          </>
                        : null}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-xs font-medium text-primary">
                      Selected
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        }
      </div>

      {/* Section B: search all users */}
      <div className="space-y-2 border-t border-border pt-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Search all users
          </h3>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="pl-8"
          />
        </div>

        {isSearching ?
          <div className="py-3 text-center text-xs text-muted-foreground">
            Searching users...
          </div>
        : searchError ?
          <p className="py-2 text-xs text-destructive">{searchError}</p>
        : searchQuery.trim().length > 0 ?
          searchResults.length === 0 ?
            <p className="py-2 text-xs text-muted-foreground">
              No users found matching &quot;{searchQuery}&quot;.
            </p>
          : <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {searchResults.map((person) => {
                const isSelected = selectedIds.has(person.profileId);
                const isDisabled = !isSelected && isMaxReached;
                return (
                  <div
                    key={person.profileId}
                    onClick={() => !isDisabled && toggleAdmin(person)}
                    className={`flex items-center justify-between rounded-md p-2 text-sm transition-colors ${
                      isDisabled ?
                        "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-secondary"
                    } ${isSelected ? "bg-secondary font-medium" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={() =>
                          !isDisabled && toggleAdmin(person)
                        }
                        aria-label={`Select ${person.displayName}`}
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-foreground">
                          {person.displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {person.email}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-medium text-primary">
                        Selected
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

        : null}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
