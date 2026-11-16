'use client';

import * as React from 'react';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

import {
  changeUserRoleAction,
  type ChangeUserRoleActionState,
} from '@/actions/user-management';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  PACE_ADMIN_DUTIES,
  type PaceAdminDuty,
} from '@/db/schema/pace-admin-assignments';
import { dutyLabels } from '@/components/admin/pace-groups/duty-labels';
import type { Role } from '@/lib/auth/authorize';
import type { UserDetails } from '@/lib/services/admin/user-management';

export type ScopeOptionBatch = {
  id: string;
  name: string;
};

export type ScopeOptionPaceGroup = {
  id: string;
  name: string;
  batchId: string;
  batchName: string;
};

export function RoleChangeDialog({
  open,
  onOpenChange,
  userDetails,
  batches,
  paceGroups,
  onRoleChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userDetails: UserDetails;
  batches: ScopeOptionBatch[];
  paceGroups: ScopeOptionPaceGroup[];
  onRoleChanged: () => void;
}) {
  const currentRole = userDetails.profile.role;
  const currentIsSuper = userDetails.profile.isSuperAdmin;

  const [selectedRole, setSelectedRole] = useState<Role>(
    currentIsSuper ? 'super_admin' : currentRole,
  );
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>(
    userDetails.batchAdminAssignments.map((b) => b.batchId),
  );
  const [selectedPaceGroupId, setSelectedPaceGroupId] = useState<string>(
    userDetails.paceAdminAssignments[0]?.paceGroupId || paceGroups[0]?.id || '',
  );
  const [selectedDuties, setSelectedDuties] = useState<PaceAdminDuty[]>(
    userDetails.paceAdminAssignments.length > 0
      ? userDetails.paceAdminAssignments.map((p) => p.duty)
      : ['daily_task'],
  );
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const [state, formAction, isPending] = useActionState<
    ChangeUserRoleActionState,
    FormData
  >(changeUserRoleAction, null);

  // Handle action response
  useEffect(() => {
    if (state?.ok) {
      toast.success('User role and assignments updated successfully.');
      onOpenChange(false);
      onRoleChanged();
    }
  }, [state, onOpenChange, onRoleChanged]);

  function toggleBatchId(batchId: string) {
    setSelectedBatchIds((prev) =>
      prev.includes(batchId)
        ? prev.filter((id) => id !== batchId)
        : [...prev, batchId],
    );
  }

  function toggleDuty(duty: PaceAdminDuty) {
    setSelectedDuties((prev) =>
      prev.includes(duty) ? prev.filter((d) => d !== duty) : [...prev, duty],
    );
  }

  // Compute what will be removed and added
  const changesSummary = React.useMemo(() => {
    const removals: string[] = [];
    const additions: string[] = [];

    // Super Admin changes
    if (currentIsSuper && selectedRole !== 'super_admin') {
      removals.push('Global Super Admin privileges');
    } else if (!currentIsSuper && selectedRole === 'super_admin') {
      additions.push(
        'Global Super Admin privileges (all permissions across platform)',
      );
    }

    // Batch Admin changes
    const currentBatchIds = new Set(
      userDetails.batchAdminAssignments.map((b) => b.batchId),
    );
    const newBatchIds = new Set(
      selectedRole === 'batch_admin' ? selectedBatchIds : [],
    );

    // Removed batches
    for (const b of userDetails.batchAdminAssignments) {
      if (!newBatchIds.has(b.batchId)) {
        removals.push(`Batch Admin: ${b.batchName}`);
      }
    }

    // Added batches
    if (selectedRole === 'batch_admin') {
      for (const id of selectedBatchIds) {
        if (!currentBatchIds.has(id)) {
          const batch = batches.find((b) => b.id === id);
          additions.push(`Batch Admin: ${batch?.name || id}`);
        }
      }
    }

    // Pace Admin changes
    const currentPaceKeys = new Set(
      userDetails.paceAdminAssignments.map((p) => `${p.paceGroupId}:${p.duty}`),
    );

    // If leaving pace_admin or changing duties
    if (selectedRole !== 'pace_admin') {
      for (const p of userDetails.paceAdminAssignments) {
        removals.push(`Pace Admin: ${p.paceGroupName} (${dutyLabels[p.duty]})`);
      }
    } else {
      // Remaining or modified pace admin
      for (const p of userDetails.paceAdminAssignments) {
        if (
          p.paceGroupId !== selectedPaceGroupId ||
          !selectedDuties.includes(p.duty)
        ) {
          removals.push(
            `Pace Admin: ${p.paceGroupName} (${dutyLabels[p.duty]})`,
          );
        }
      }
      const group = paceGroups.find((g) => g.id === selectedPaceGroupId);
      for (const d of selectedDuties) {
        if (!currentPaceKeys.has(`${selectedPaceGroupId}:${d}`)) {
          additions.push(
            `Pace Admin: ${group?.name || selectedPaceGroupId} (${dutyLabels[d]})`,
          );
        }
      }
    }

    if (selectedRole === 'member' && removals.length === 0) {
      additions.push('Confirmed as standard Member (no administrative scope)');
    }

    return { removals, additions };
  }, [
    currentIsSuper,
    selectedRole,
    userDetails,
    selectedBatchIds,
    selectedPaceGroupId,
    selectedDuties,
    batches,
    paceGroups,
  ]);

  const paceAssignmentsPayload = React.useMemo(() => {
    if (selectedRole !== 'pace_admin' || !selectedPaceGroupId) return '[]';
    return JSON.stringify(
      selectedDuties.map((duty) => ({
        paceGroupId: selectedPaceGroupId,
        duty,
      })),
    );
  }, [selectedRole, selectedPaceGroupId, selectedDuties]);

  const isBatchAdminInvalid =
    selectedRole === 'batch_admin' && selectedBatchIds.length === 0;
  const isPaceAdminInvalid =
    selectedRole === 'pace_admin' &&
    (!selectedPaceGroupId || selectedDuties.length === 0);

  const canSubmit =
    confirmed && !isPending && !isBatchAdminInvalid && !isPaceAdminInvalid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Change Role & Administrative Scope</DialogTitle>
          <DialogDescription>
            Modify {userDetails.profile.name}’s global role and assign
            appropriate administrative scopes.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-6">
          <input
            type="hidden"
            name="targetProfileId"
            value={userDetails.profile.id}
          />
          <input type="hidden" name="newRole" value={selectedRole} />
          <input
            type="hidden"
            name="paceAssignments"
            value={paceAssignmentsPayload}
          />
          <input type="hidden" name="confirmed" value={String(confirmed)} />

          {selectedRole === 'batch_admin' &&
            selectedBatchIds.map((batchId) => (
              <input
                key={batchId}
                type="hidden"
                name="batchIds"
                value={batchId}
              />
            ))}

          {/* 1. Select Desired Role */}
          <div className="space-y-2">
            <Label htmlFor="role-select">Desired Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(val) => {
                if (val) setSelectedRole(val as Role);
              }}
            >
              <SelectTrigger id="role-select" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="pace_admin">Pace Admin</SelectItem>
                <SelectItem value="batch_admin">Batch Admin</SelectItem>
                <SelectItem value="super_admin">
                  Super Admin (Global)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 2. Role-specific Scope Selection */}
          {selectedRole === 'batch_admin' ? (
            <div className="space-y-3 rounded-lg border border-border bg-surface-container p-4">
              <div className="flex items-center justify-between">
                <Label className="font-medium">
                  Assign Batches <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  Select 1 to 5 batches
                </span>
              </div>
              {batches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No batches available.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {batches.map((batch) => {
                    const checked = selectedBatchIds.includes(batch.id);
                    return (
                      <label
                        key={batch.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm hover:bg-surface-2"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleBatchId(batch.id)}
                        />
                        <span className="truncate">{batch.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {isBatchAdminInvalid ? (
                <p className="text-xs text-destructive">
                  Please select at least one batch for the Batch Admin role.
                </p>
              ) : null}
            </div>
          ) : null}

          {selectedRole === 'pace_admin' ? (
            <div className="space-y-4 rounded-lg border border-border bg-surface-container p-4">
              <div className="space-y-2">
                <Label htmlFor="pace-group-select">
                  Pace Group <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedPaceGroupId}
                  onValueChange={(val) => setSelectedPaceGroupId(val || '')}
                >
                  <SelectTrigger id="pace-group-select" className="w-full">
                    <SelectValue placeholder="Select pace group" />
                  </SelectTrigger>
                  <SelectContent>
                    {paceGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.batchName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">
                  Duties <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {PACE_ADMIN_DUTIES.map((duty) => {
                    const checked = selectedDuties.includes(duty);
                    return (
                      <label
                        key={duty}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm hover:bg-surface-2"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleDuty(duty)}
                        />
                        <span>{dutyLabels[duty]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {isPaceAdminInvalid ? (
                <p className="text-xs text-destructive">
                  Please select a pace group and at least one duty.
                </p>
              ) : null}
            </div>
          ) : null}

          {selectedRole === 'super_admin' ? (
            <div className="flex items-start gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm text-foreground">
              <ShieldAlert className="size-5 shrink-0 text-gold" />
              <div>
                <p className="font-medium text-foreground">
                  Full Platform Authority
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Super Admins have universal read and write access across all
                  batches, pace groups, catalog entries, and system settings.
                </p>
              </div>
            </div>
          ) : null}

          {/* 3. Changes Summary (Diff) */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <h4 className="text-sm font-semibold text-foreground">
              Summary of Impact
            </h4>

            {changesSummary.removals.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-destructive">
                  Assignments / Permissions to be removed:
                </p>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {changesSummary.removals.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {changesSummary.additions.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-teal">
                  Assignments / Permissions to be added:
                </p>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {changesSummary.additions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {changesSummary.removals.length === 0 &&
            changesSummary.additions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No assignment changes detected.
              </p>
            ) : null}
          </div>

          {/* Reason (optional) */}
          <div className="space-y-2">
            <Label htmlFor="change-reason">Reason for Change (Optional)</Label>
            <Textarea
              id="change-reason"
              name="reason"
              placeholder="e.g. Promoted to Batch Admin for Spring 2026 batch"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Error Message */}
          {state && !state.ok ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{state.formError || 'Failed to update user role.'}</span>
            </div>
          ) : null}

          {/* 4. Explicit Confirmation Checkbox */}
          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(Boolean(checked))}
                className="mt-0.5"
              />
              <span className="text-xs text-foreground">
                I confirm that I want to apply these role and assignment
                changes. I understand that any removed scopes will immediately
                revoke associated administrative privileges.
              </span>
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? 'Applying Changes...' : 'Confirm Role Change'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
