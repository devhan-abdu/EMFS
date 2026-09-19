'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Search, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchProfilesAction } from '@/actions/user-search';
import {
  assignPaceAdminAction,
  removePaceAdminAssignmentAction,
} from '@/actions/pace-admin';
import { PACE_ADMIN_DUTIES } from '@/db/schema/pace-admin-assignments';
import { dutyLabels } from './duty-labels';
import type { PaceGroupWithAdmins } from './types';
import type { ProfileSearchResult } from '@/lib/validations/user-search';

export function PaceAdminAssignDialog({
  open,
  onOpenChange,
  group,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: PaceGroupWithAdmins | null;
  onChanged: () => void;
}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<ProfileSearchResult[]>([]);
  const [selected, setSelected] = React.useState<ProfileSearchResult | null>(
    null,
  );
  const [duty, setDuty] =
    React.useState<(typeof PACE_ADMIN_DUTIES)[number]>('daily_task');
  const [formError, setFormError] = React.useState<string | null>(null);

  const [isSearching, startSearch] = React.useTransition();
  const [isSubmitting, startSubmit] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setDuty('daily_task');
      setFormError(null);
    }
    onOpenChange(nextOpen);
  }

  function runSearch(value: string) {
    setQuery(value);
    setSelected(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const result = await searchProfilesAction(value);
      setResults(result.ok ? result.data : []);
    });
  }

  function handleAssign() {
    if (!group || !selected) return;
    setFormError(null);

    startSubmit(async () => {
      const result = await assignPaceAdminAction({
        profileId: selected.profileId,
        paceGroupId: group.id,
        duty,
      });

      if (result.ok) {
        toast.success(
          `${selected.displayName} assigned as ${dutyLabels[duty]}`,
        );
        setSelected(null);
        setQuery('');
        setResults([]);
        onChanged();
        onOpenChange(false);
      } else {
        const errorMsg =
          result.errors?.formErrors?.[0] ?? 'Could not assign pace admin';
        setFormError(errorMsg);
        toast.error(errorMsg);
      }
    });
  }

  function handleRemove(assignmentId: string) {
    setRemovingId(assignmentId);
    setFormError(null);

    startSubmit(async () => {
      const result = await removePaceAdminAssignmentAction({ assignmentId });
      setRemovingId(null);

      if (result.ok) {
        toast.success('Assignment removed');
        onChanged();
      } else {
        const errorMsg =
          result.errors?.formErrors?.[0] ?? 'Could not remove assignment';
        setFormError(errorMsg);
        toast.error(errorMsg);
      }
    });
  }

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pace admins — {group.name}</DialogTitle>
          <DialogDescription>
            Search an existing account and assign a duty.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <p className="text-xs font-medium text-destructive">{formError}</p>
          )}

          {/* Current Assigned Admins Roster */}
          {group.admins.length > 0 && (
            <div className="space-y-2">
              {group.admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between rounded-lg bg-surface-container px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-foreground">
                      {admin.profile.fullName || admin.profile.email}
                    </span>
                    <Badge variant="secondary" className="ml-2">
                      {dutyLabels[admin.duty]}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isSubmitting && removingId === admin.id}
                    onClick={() => handleRemove(admin.id)}
                    aria-label={`Remove ${admin.profile.fullName ?? 'admin'}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <FieldGroup>
            {/* Person Search Field */}
            <Field>
              <FieldLabel htmlFor="admin-search">Find a person</FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-search"
                  value={query}
                  onChange={(e) => runSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="pl-9"
                  disabled={isSubmitting}
                />
              </div>
              {isSearching && (
                <p className="mt-1 text-xs text-muted-foreground">Searching…</p>
              )}
              {results.length > 0 && (
                <div className="mt-1 max-h-40 space-y-1 overflow-auto rounded-lg border border-border p-1">
                  {results.map((r) => (
                    <button
                      key={r.profileId}
                      type="button"
                      onClick={() => {
                        setSelected(r);
                        setResults([]);
                        setQuery(r.displayName);
                      }}
                      className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-medium text-foreground">
                        {r.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Field>

            {/* Admin Duty Selector */}
            <Field>
              <FieldLabel htmlFor="admin-duty">Duty</FieldLabel>
              <Select
                value={duty}
                onValueChange={(v) =>
                  setDuty((v as typeof duty) ?? 'daily_task')
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="admin-duty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACE_ADMIN_DUTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {dutyLabels[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <Button
            className="w-full"
            disabled={!selected || isSubmitting}
            onClick={handleAssign}
          >
            {isSubmitting ? 'Assigning…' : 'Assign pace admin'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
