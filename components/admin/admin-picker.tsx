"use client";

import { useState, useEffect, useTransition } from "react";
import { getPreviouslyAssignedBatchAdminsAction, searchUsersAction } from "@/actions/batch";
import type { AdminPickerUser } from "@/lib/services/user-search";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { X, Search, UserCheck, Users } from "lucide-react";

export type AdminPickerProps = {
  initialSelectedAdmins?: AdminPickerUser[];
  error?: string;
  maxAdmins?: number;
};

export function AdminPicker({
  initialSelectedAdmins = [],
  error,
  maxAdmins = 3,
}: AdminPickerProps) {
  const [selectedAdmins, setSelectedAdmins] = useState<AdminPickerUser[]>(initialSelectedAdmins);
  const [previousAdmins, setPreviousAdmins] = useState<AdminPickerUser[]>([]);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminPickerUser[]>([]);
  const [isSearching, startSearchTransition] = useTransition();

  // Load previously assigned batch admins on mount (Section A)
  useEffect(() => {
    let isMounted = true;
    async function loadPreviousAdmins() {
      setIsLoadingPrevious(true);
      try {
        const res = await getPreviouslyAssignedBatchAdminsAction();
        if (res.ok && res.data && isMounted) {
          setPreviousAdmins(res.data);
        }
      } catch (err) {
        console.error("Failed to load previously assigned batch admins:", err);
      } finally {
        if (isMounted) {
          setIsLoadingPrevious(false);
        }
      }
    }
    loadPreviousAdmins();
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced search for all users (Section B)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const res = await searchUsersAction(trimmed);
          if (res.ok && res.data) {
            setSearchResults(res.data);
          }
        } catch (err) {
          console.error("Failed to search users:", err);
        }
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayedSearchResults = searchQuery.trim() ? searchResults : [];
  const selectedIds = new Set(selectedAdmins.map((a) => a.id));
  const isMaxReached = selectedAdmins.length >= maxAdmins;

  function toggleAdmin(user: AdminPickerUser) {
    if (selectedIds.has(user.id)) {
      setSelectedAdmins((prev) => prev.filter((a) => a.id !== user.id));
    } else {
      if (isMaxReached) {
        return;
      }
      setSelectedAdmins((prev) => [...prev, user]);
    }
  }

  function removeAdmin(userId: string) {
    setSelectedAdmins((prev) => prev.filter((a) => a.id !== userId));
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      {/* Header & Limits description */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-semibold text-foreground">
            Batch Admins (1–3)
          </label>
          <p className="text-xs text-muted-foreground">
            Select 1 to 3 batch admins to manage registration, pace groups, and pacing.
          </p>
        </div>
        <span
          className={`text-xs font-medium ${
            selectedAdmins.length === 0
              ? "text-destructive"
              : selectedAdmins.length > maxAdmins
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {selectedAdmins.length} of {maxAdmins} selected
        </span>
      </div>

      {/* Hidden inputs to submit selected admin IDs through native FormData */}
      {selectedAdmins.map((admin) => (
        <input key={admin.id} type="hidden" name="adminIds" value={admin.id} />
      ))}

      {/* Selected Admins Chips */}
      {selectedAdmins.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Selected admins:
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedAdmins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm shadow-xs"
              >
                <div className="flex flex-col text-left">
                  <span className="font-medium text-foreground">{admin.name}</span>
                  <span className="text-xs text-muted-foreground">{admin.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAdmin(admin.id)}
                  className="ml-1 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-hidden"
                  aria-label={`Remove ${admin.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section A: Previously assigned batch admins */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Previously assigned batch admins
          </h3>
        </div>

        {isLoadingPrevious ? (
          <div className="space-y-2 py-2">
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/60" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/60" />
          </div>
        ) : previousAdmins.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No previously assigned batch admins found. Search all users below.
          </p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {previousAdmins.map((admin) => {
              const isSelected = selectedIds.has(admin.id);
              const isDisabled = !isSelected && isMaxReached;

              return (
                <div
                  key={admin.id}
                  onClick={() => {
                    if (!isDisabled) toggleAdmin(admin);
                  }}
                  className={`flex items-center justify-between rounded-md p-2 text-sm transition-colors ${
                    isDisabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-secondary"
                  } ${isSelected ? "bg-secondary font-medium" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={() => {
                        if (!isDisabled) toggleAdmin(admin);
                      }}
                      aria-label={`Select ${admin.name}`}
                    />
                    <div className="flex flex-col text-left">
                      <span className="text-foreground">{admin.name}</span>
                      <span className="text-xs text-muted-foreground">{admin.email}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-xs font-medium text-primary">Selected</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section B: Search all users */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Search all users</h3>
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

        {isSearching ? (
          <div className="py-3 text-center text-xs text-muted-foreground">
            Searching users...
          </div>
        ) : searchQuery.trim().length > 0 ? (
          displayedSearchResults.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">
              No users found matching &quot;{searchQuery}&quot;.
            </p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {displayedSearchResults.map((user) => {
                const isSelected = selectedIds.has(user.id);
                const isDisabled = !isSelected && isMaxReached;

                return (
                  <div
                    key={user.id}
                    onClick={() => {
                      if (!isDisabled) toggleAdmin(user);
                    }}
                    className={`flex items-center justify-between rounded-md p-2 text-sm transition-colors ${
                      isDisabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:bg-secondary"
                    } ${isSelected ? "bg-secondary font-medium" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={() => {
                          if (!isDisabled) toggleAdmin(user);
                        }}
                        aria-label={`Select ${user.name}`}
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-foreground">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-medium text-primary">Selected</span>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </div>

      {/* Field error display */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
