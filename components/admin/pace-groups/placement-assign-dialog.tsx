'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Layers,
  UserPlus,
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
import { Input } from '@/components/ui/input';
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
import { assignMemberAction, moveMemberAction } from '@/actions/placement';
import type { BatchRosterMember } from '@/lib/services/pace-groups/placement';
import type { PaceGroupWithAdmins } from './types';

export type PlacementDialogTarget = {
  member: BatchRosterMember;
  mode: 'assign' | 'move';
};

export function PlacementAssignDialog({
  open,
  onOpenChange,
  batchId,
  target,
  paceGroups,
  groupMemberCounts = {},
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  target: PlacementDialogTarget | null;
  paceGroups: PaceGroupWithAdmins[];
  groupMemberCounts?: Record<string, number>;
  onSuccess?: () => void;
}) {
  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <PlacementForm
          key={`${target.member.profileId}-${target.mode}`}
          batchId={batchId}
          target={target}
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

function PlacementForm({
  batchId,
  target,
  paceGroups,
  groupMemberCounts,
  onSuccess,
  onClose,
}: {
  batchId: string;
  target: PlacementDialogTarget;
  paceGroups: PaceGroupWithAdmins[];
  groupMemberCounts: Record<string, number>;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { member, mode } = target;
  const isMove = mode === 'move';

  // Active groups excluding current group if moving
  const availableGroups = React.useMemo(() => {
    return paceGroups.filter(
      (g) => !g.archived && (!isMove || g.id !== member.paceGroupId),
    );
  }, [paceGroups, isMove, member.paceGroupId]);

  // Two-step workflow: 'select-group' -> 'confirm'
  const [step, setStep] = React.useState<'select-group' | 'confirm'>(
    'select-group',
  );
  const [targetGroupId, setTargetGroupId] = React.useState<string>('');
  const [moveReason, setMoveReason] = React.useState<string>('Pace adjustment');
  const [notes, setNotes] = React.useState<string>('');
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const selectedTargetGroup = availableGroups.find(
    (g) => g.id === targetGroupId,
  );
  const currentCount = selectedTargetGroup
    ? (groupMemberCounts[selectedTargetGroup.id] ?? 0)
    : 0;

  function handleProceedToConfirm(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const errors: Record<string, string[]> = {};
    if (!targetGroupId) {
      errors.paceGroupId = ['Please select a target pace group.'];
    }
    if (isMove && !moveReason.trim()) {
      errors.moveReason = ['Please provide a reason for the move.'];
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setStep('confirm');
  }

  function handleCommit() {
    if (!targetGroupId || isPending) return;

    setFormError(null);
    startTransition(async () => {
      const result = isMove
        ? await moveMemberAction({
            batchId,
            profileId: member.profileId,
            toPaceGroupId: targetGroupId,
            moveReason: moveReason.trim(),
            notes: notes.trim() || undefined,
          })
        : await assignMemberAction({
            batchId,
            profileId: member.profileId,
            paceGroupId: targetGroupId,
            notes: notes.trim() || undefined,
          });

      if (result.ok) {
        toast.success(
          isMove
            ? `${member.name} moved to ${selectedTargetGroup?.name ?? 'new group'}`
            : `${member.name} placed in ${selectedTargetGroup?.name ?? 'pace group'}`,
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
          'Placement operation failed. No changes were made.',
      );
    });
  }

  // STEP 1: TARGET GROUP PICKER
  if (step === 'select-group') {
    return (
      <form onSubmit={handleProceedToConfirm} className="space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isMove ? (
              <>
                <ArrowRightLeft className="size-5 text-primary" />
                Move to pace group
              </>
            ) : (
              <>
                <UserPlus className="size-5 text-primary" />
                Place in pace group
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isMove
              ? `Select a new pace group for ${member.name}.`
              : `Select a pace group to assign ${member.name}.`}
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
            {formError}
          </div>
        )}

        {/* Member Profile Summary */}
        <div className="rounded-xl bg-surface-container p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {member.name}
              </p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
            {member.pacePreference ? (
              <Badge variant="outline" className="text-xs">
                Prefers {member.pacePreference} pages/day
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                No preference
              </span>
            )}
          </div>
          {isMove && member.paceGroupName && (
            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              Current group:{' '}
              <span className="font-medium text-foreground">
                {member.paceGroupName}
              </span>
            </div>
          )}
        </div>

        <FieldGroup className="space-y-4">
          {/* Target Group Selector */}
          <Field data-invalid={!!fieldErrors.paceGroupId?.length}>
            <FieldLabel htmlFor="placement-target-group">
              {isMove ? 'New target pace group' : 'Target pace group'}
            </FieldLabel>
            {availableGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {isMove
                  ? 'No other active pace groups available in this batch to move to.'
                  : 'No active pace groups available in this batch.'}
              </p>
            ) : (
              <Select
                value={targetGroupId}
                onValueChange={(v) => {
                  setTargetGroupId(v ?? '');
                  setFieldErrors((prev) => ({ ...prev, paceGroupId: [] }));
                }}
              >
                <SelectTrigger id="placement-target-group" className="w-full">
                  <SelectValue placeholder="Choose a pace group..." />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.map((g) => {
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
            {fieldErrors.paceGroupId?.[0] && (
              <FieldError>{fieldErrors.paceGroupId[0]}</FieldError>
            )}
          </Field>

          {/* Move Reason (Only for move) */}
          {isMove && (
            <Field data-invalid={!!fieldErrors.moveReason?.length}>
              <FieldLabel htmlFor="placement-move-reason">
                Reason for move
              </FieldLabel>
              <Input
                id="placement-move-reason"
                value={moveReason}
                onChange={(e) => {
                  setMoveReason(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, moveReason: [] }));
                }}
                placeholder="e.g. Pace adjustment, member request, schedule change"
                required
              />
              {fieldErrors.moveReason?.[0] && (
                <FieldError>{fieldErrors.moveReason[0]}</FieldError>
              )}
            </Field>
          )}

          {/* Admin Notes */}
          <Field data-invalid={!!fieldErrors.notes?.length}>
            <FieldLabel htmlFor="placement-notes">
              Notes{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </FieldLabel>
            <Textarea
              id="placement-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any internal context for this placement decision..."
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
            disabled={!targetGroupId || availableGroups.length === 0}
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
          {isMove ? 'Confirm member move' : 'Confirm member placement'}
        </DialogTitle>
        <DialogDescription>
          Review member details and destination pace group before committing.
        </DialogDescription>
      </DialogHeader>

      {formError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
          {formError}
        </div>
      )}

      {/* Target Pace Group Card */}
      <Card className="card-soft border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Destination pace group:
            </span>
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
              {currentCount} → {currentCount + 1} members
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Member Details Confirmation Card */}
      <Card className="card-soft">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">
                {member.name}
              </p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
            {member.pacePreference ? (
              <Badge variant="outline" className="text-xs">
                Prefers {member.pacePreference} p/d
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                No preference
              </span>
            )}
          </div>

          <div className="border-t border-border pt-2 text-xs flex items-center justify-between text-muted-foreground">
            <span>
              {isMove
                ? `From: ${member.paceGroupName ?? 'Unplaced'}`
                : 'Current status: Unplaced'}
            </span>
            <span className="font-medium text-primary">
              To: {selectedTargetGroup?.name}
            </span>
          </div>

          {isMove && (
            <div className="border-t border-border pt-2 text-xs">
              <span className="text-muted-foreground">Reason: </span>
              <span className="font-medium text-foreground">{moveReason}</span>
            </div>
          )}

          {notes.trim() && (
            <div className="border-t border-border pt-2 text-xs">
              <span className="text-muted-foreground">Note: </span>
              <span className="italic text-foreground">
                &ldquo;{notes.trim()}&rdquo;
              </span>
            </div>
          )}
        </CardContent>
      </Card>

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
        <Button type="button" onClick={handleCommit} disabled={isPending}>
          {isPending
            ? 'Committing…'
            : isMove
              ? 'Confirm & move member'
              : 'Confirm & place member'}
        </Button>
      </DialogFooter>
    </div>
  );
}
