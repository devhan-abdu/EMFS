'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Layers,
  Users,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
import { bulkAssignMembersAction } from '@/actions/placement';
import type { BatchRosterMember } from '@/lib/services/pace-groups/placement';
import type { PaceGroupWithAdmins } from './types';

export function BulkPlacementDialog({
  open,
  onOpenChange,
  batchId,
  selectedMembers,
  paceGroups,
  groupMemberCounts = {},
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  selectedMembers: BatchRosterMember[];
  paceGroups: PaceGroupWithAdmins[];
  groupMemberCounts?: Record<string, number>;
  onSuccess?: () => void;
}) {
  if (selectedMembers.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <BulkPlacementWizard
          key={`bulk-wizard-${selectedMembers.length}-${selectedMembers
            .map((m) => m.profileId)
            .slice(0, 3)
            .join('-')}`}
          batchId={batchId}
          selectedMembers={selectedMembers}
          paceGroups={paceGroups}
          groupMemberCounts={groupMemberCounts}
          onSuccess={() => {
            onSuccess?.();
            onOpenChange(false);
          }}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function BulkPlacementWizard({
  batchId,
  selectedMembers,
  paceGroups,
  groupMemberCounts,
  onSuccess,
  onClose,
}: {
  batchId: string;
  selectedMembers: BatchRosterMember[];
  paceGroups: PaceGroupWithAdmins[];
  groupMemberCounts: Record<string, number>;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const activeGroups = paceGroups.filter((g) => !g.archived);

  // Workflow steps: 'select-group' -> 'confirm'
  const [step, setStep] = React.useState<'select-group' | 'confirm'>(
    'select-group',
  );

  // Explicit target group selection (starts empty so admin must explicitly choose)
  const [targetGroupId, setTargetGroupId] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const selectedTargetGroup = activeGroups.find((g) => g.id === targetGroupId);
  const currentTargetCount = selectedTargetGroup
    ? (groupMemberCounts[selectedTargetGroup.id] ?? 0)
    : 0;

  const unplacedCount = selectedMembers.filter(
    (m) => m.placementStatus === 'unplaced',
  ).length;
  const movingCount = selectedMembers.filter(
    (m) => m.placementStatus === 'placed',
  ).length;

  function handleProceedToConfirm(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    if (!targetGroupId) {
      setFieldErrors({ targetGroupId: ['Please select a target pace group.'] });
      return;
    }

    setStep('confirm');
  }

  function handleCommitAssignment() {
    if (!targetGroupId || isPending) return;

    setFormError(null);
    startTransition(async () => {
      const profileIds = selectedMembers.map((m) => m.profileId);
      const result = await bulkAssignMembersAction({
        batchId,
        targetGroupId,
        profileIds,
        notes: notes.trim() || undefined,
      });

      if (result.ok) {
        toast.success(
          `Assigned ${result.data.processedCount} member${result.data.processedCount === 1 ? '' : 's'} to ${selectedTargetGroup?.name ?? 'pace group'}`,
        );
        router.refresh();
        onSuccess();
        return;
      }

      if (result.errors?.fieldErrors) {
        setFieldErrors(result.errors.fieldErrors as Record<string, string[]>);
      }
      setFormError(
        result.errors?.formErrors?.[0] ??
          'Bulk assignment failed. No changes were made.',
      );
    });
  }

  // STEP 1: TARGET GROUP PICKER
  if (step === 'select-group') {
    return (
      <form onSubmit={handleProceedToConfirm} className="space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Assign to pace group
          </DialogTitle>
          <DialogDescription>
            Choose the target pace group for the {selectedMembers.length}{' '}
            selected member{selectedMembers.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
            {formError}
          </div>
        )}

        {/* Selected count info banner */}
        <div className="rounded-xl bg-surface-container p-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            {selectedMembers.length} member
            {selectedMembers.length === 1 ? '' : 's'} selected
          </span>
          <span className="text-muted-foreground">
            {unplacedCount} unplaced · {movingCount} moving
          </span>
        </div>

        <FieldGroup className="space-y-4">
          {/* Target Group Selector */}
          <Field data-invalid={!!fieldErrors.targetGroupId?.length}>
            <FieldLabel htmlFor="bulk-target-group">
              Target pace group
            </FieldLabel>
            {activeGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active pace groups available in this batch.
              </p>
            ) : (
              <Select
                value={targetGroupId}
                onValueChange={(v) => {
                  setTargetGroupId(v ?? '');
                  setFieldErrors({});
                }}
              >
                <SelectTrigger
                  id="bulk-target-group"
                  className="w-full"
                  aria-label="Select target pace group"
                >
                  <SelectValue placeholder="Choose a target pace group..." />
                </SelectTrigger>
                <SelectContent>
                  {activeGroups.map((g) => {
                    const count = groupMemberCounts[g.id] ?? 0;
                    return (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.size} pages/day) — {count} member
                        {count === 1 ? '' : 's'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {fieldErrors.targetGroupId?.[0] && (
              <FieldError>{fieldErrors.targetGroupId[0]}</FieldError>
            )}
          </Field>

          {/* Optional Notes */}
          <Field data-invalid={!!fieldErrors.notes?.length}>
            <FieldLabel htmlFor="bulk-notes">
              Notes{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </FieldLabel>
            <Textarea
              id="bulk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any audit notes for this placement decision..."
              rows={2}
            />
            {fieldErrors.notes?.[0] && (
              <FieldError>{fieldErrors.notes[0]}</FieldError>
            )}
          </Field>
        </FieldGroup>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!targetGroupId || activeGroups.length === 0}
            className="gap-2"
          >
            Continue to confirmation
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </form>
    );
  }

  // STEP 2: CONFIRMATION CARD BEFORE COMMITTING
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          Confirm placement
        </DialogTitle>
        <DialogDescription>
          Review every selected member and destination group before committing.
        </DialogDescription>
      </DialogHeader>

      {formError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
          {formError}
        </div>
      )}

      {/* Destination Target Group Card */}
      <Card className="card-soft border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Destination group:</span>
            <span className="font-semibold text-primary">
              {selectedTargetGroup?.size} pages/day
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <p className="font-display text-base font-bold text-foreground">
                {selectedTargetGroup?.name}
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {currentTargetCount} →{' '}
              {currentTargetCount + selectedMembers.length} members
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Selected Members Roster Confirmation List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            Assigned members ({selectedMembers.length})
          </span>
          <span className="text-muted-foreground">Page-size preference</span>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-2 space-y-2">
          {selectedMembers.map((member) => (
            <div
              key={member.profileId}
              className="flex items-center justify-between rounded-lg bg-surface-container/50 p-2 text-xs"
            >
              <div className="space-y-0">
                <p className="font-medium text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground">
                  {member.paceGroupName
                    ? `Moving from: ${member.paceGroupName}`
                    : 'Currently unplaced'}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {member.pacePreference ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    Prefers {member.pacePreference} p/d
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No preference
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes preview if entered */}
      {notes.trim() && (
        <div className="rounded-xl bg-surface-container p-4 text-xs space-y-2">
          <p className="font-medium text-foreground">Placement note:</p>
          <p className="text-muted-foreground italic">
            &ldquo;{notes.trim()}&rdquo;
          </p>
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep('select-group')}
          disabled={isPending}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleCommitAssignment}
          disabled={isPending}
        >
          {isPending
            ? 'Committing…'
            : `Confirm & assign (${selectedMembers.length})`}
        </Button>
      </DialogFooter>
    </div>
  );
}
