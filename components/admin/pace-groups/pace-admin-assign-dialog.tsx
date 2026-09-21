'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, UserPlus, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  searchProfilesAction,
  getPreviouslyAssignedPaceAdminsAction,
} from '@/actions/user-search';
import {
  assignPaceAdminAction,
  removePaceAdminAssignmentAction,
} from '@/actions/pace-admin';
import { PACE_ADMIN_DUTIES } from '@/db/schema/pace-admin-assignments';
import { dutyLabels } from './duty-labels';
import type { PaceGroupWithAdmins } from './types';
import type { ProfileSearchResult } from '@/lib/validations/user-search';

const SEARCH_DEBOUNCE_MS = 300;

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
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [suggested, setSuggested] = React.useState<ProfileSearchResult[]>([]);
  const [results, setResults] = React.useState<ProfileSearchResult[]>([]);
  const [selected, setSelected] = React.useState<ProfileSearchResult | null>(
    null,
  );
  const [duty, setDuty] =
    React.useState<(typeof PACE_ADMIN_DUTIES)[number]>('daily_task');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dutyError, setDutyError] = React.useState<string | null>(null);

  const [isLoadingSuggested, startLoadSuggested] = React.useTransition();
  const [isSearching, startSearch] = React.useTransition();
  const [isSubmitting, startSubmit] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  function resetForm() {
    setQuery('');
    setResults([]);
    setSelected(null);
    setDuty('daily_task');
    setFormError(null);
    setDutyError(null);
    setPickerOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  React.useEffect(() => {
    if (!open) return;

    startLoadSuggested(async () => {
      const result = await getPreviouslyAssignedPaceAdminsAction();
      setSuggested(result.ok ? result.data : []);
    });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const handle = window.setTimeout(() => {
      startSearch(async () => {
        const result = await searchProfilesAction(trimmed);
        setResults(result.ok ? result.data : []);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [query, open]);

  const suggestedIds = new Set(suggested.map((s) => s.profileId));
  const searchOnly = results.filter((r) => !suggestedIds.has(r.profileId));
  const assignedIds = new Set(group?.admins.map((a) => a.profile.id) ?? []);

  function handleAssign() {
    if (!group || !selected) return;
    setFormError(null);
    setDutyError(null);

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
        resetForm();
        onChanged();
        onOpenChange(false);
      } else {
        const fieldDuty = result.errors?.fieldErrors?.duty?.[0];
        if (fieldDuty) setDutyError(fieldDuty);
        const errorMsg =
          result.errors?.formErrors?.[0] ??
          fieldDuty ??
          'Could not assign pace admin';
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
          <DialogTitle className="flex items-center justify-between gap-2 pr-8">
            <span>Pace admins — {group.name}</span>
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/admin/roles">
                <UserPlus className="size-4" />
                Invite admin
              </Link>
            </Button>
          </DialogTitle>
          <DialogDescription>
            Pick a previously assigned pace admin or search by name or email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <p className="text-xs font-medium text-destructive">{formError}</p>
          )}

          {group.admins.length > 0 && (
            <div className="space-y-2">
              {group.admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between rounded-lg bg-surface-container px-4 py-2 text-sm"
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
            <Field>
              <FieldLabel>Find a person</FieldLabel>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={pickerOpen}
                      className="w-full justify-between font-normal"
                      disabled={isSubmitting}
                    >
                      {selected ? selected.displayName : 'Search admins…'}
                      <ChevronsUpDown className="size-4 opacity-50" />
                    </Button>
                  }
                />
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type a name or email…"
                      value={query}
                      onValueChange={(value) => {
                        setQuery(value);
                        setSelected(null);
                        if (value.trim().length < 2) {
                          setResults([]);
                        }
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {isSearching || isLoadingSuggested
                          ? 'Searching…'
                          : query.trim().length < 2
                            ? 'Type at least 2 characters to search.'
                            : 'No people found.'}
                      </CommandEmpty>

                      {suggested.length > 0 && (
                        <CommandGroup heading="Previously assigned">
                          {suggested.map((admin) => (
                            <AdminPickerItem
                              key={admin.profileId}
                              admin={admin}
                              isSelected={
                                selected?.profileId === admin.profileId
                              }
                              disabled={assignedIds.has(admin.profileId)}
                              onSelect={() => {
                                setSelected(admin);
                                setQuery(admin.displayName);
                                setResults([]);
                                setPickerOpen(false);
                              }}
                            />
                          ))}
                        </CommandGroup>
                      )}

                      {searchOnly.length > 0 && (
                        <CommandGroup heading="Search results">
                          {searchOnly.map((admin) => (
                            <AdminPickerItem
                              key={admin.profileId}
                              admin={admin}
                              isSelected={
                                selected?.profileId === admin.profileId
                              }
                              disabled={assignedIds.has(admin.profileId)}
                              onSelect={() => {
                                setSelected(admin);
                                setQuery(admin.displayName);
                                setResults([]);
                                setPickerOpen(false);
                              }}
                            />
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            <Field data-invalid={!!dutyError}>
              <FieldLabel htmlFor="admin-duty">Duty</FieldLabel>
              <Select
                value={duty}
                onValueChange={(v) => {
                  setDuty((v as typeof duty) ?? 'daily_task');
                  setDutyError(null);
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger id="admin-duty" className="w-full">
                  <SelectValue>{dutyLabels[duty]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PACE_ADMIN_DUTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {dutyLabels[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dutyError && <FieldError>{dutyError}</FieldError>}
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

function AdminPickerItem({
  admin,
  isSelected,
  disabled,
  onSelect,
}: {
  admin: ProfileSearchResult;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${admin.displayName} ${admin.email}`}
      disabled={disabled}
      onSelect={onSelect}
      className={cn(disabled && 'opacity-50')}
    >
      <Check
        className={cn('mr-2 size-4', isSelected ? 'opacity-100' : 'opacity-0')}
      />
      <div className="flex flex-1 flex-col">
        <span>{admin.displayName}</span>
        <span className="text-xs text-muted-foreground">{admin.email}</span>
      </div>
    </CommandItem>
  );
}
