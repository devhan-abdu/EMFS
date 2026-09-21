'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Check, Clock, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  approveMoveRequestAction,
  rejectMoveRequestAction,
} from '@/actions/placement';
import type { PendingMoveRequestItem } from '@/lib/services/pace-groups/placement';

export function PendingMoveRequestsPanel({
  batchId,
  initialRequests,
}: {
  batchId: string;
  initialRequests: PendingMoveRequestItem[];
}) {
  const router = useRouter();
  const requests = initialRequests;
  const [approveTarget, setApproveTarget] =
    React.useState<PendingMoveRequestItem | null>(null);
  const [rejectTarget, setRejectTarget] =
    React.useState<PendingMoveRequestItem | null>(null);

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center">
        <Clock className="mx-auto size-8 text-muted-foreground opacity-60" />
        <p className="mt-2 font-display text-lg font-semibold text-foreground">
          No pending move requests
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          When members request a pace group change, their requests will appear
          here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {requests.length} pending move request
          {requests.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-4">
        {requests.map((req) => (
          <Card key={req.id} className="card-soft">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{req.name}</p>
                  <span className="text-xs text-muted-foreground">
                    · {req.email}
                  </span>
                  {req.pacePreference && (
                    <Badge variant="outline" className="text-xs">
                      Prefers {req.pacePreference} pages
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {req.currentPaceGroupName ?? 'Unplaced'}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span className="font-medium text-primary">
                    {req.requestedPaceGroupName} ({req.requestedPaceGroupSize}{' '}
                    pages/day)
                  </span>
                </div>

                {req.reason && (
                  <p className="text-xs italic text-muted-foreground bg-surface-container rounded-lg p-2">
                    &ldquo;{req.reason}&rdquo;
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Requested on{' '}
                  {new Date(req.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => setApproveTarget(req)}
                >
                  <Check className="size-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setRejectTarget(req)}
                >
                  <X className="size-4" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Approve Dialog */}
      <ApproveRequestDialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        batchId={batchId}
        target={approveTarget}
        onSuccess={() => {
          setApproveTarget(null);
          router.refresh();
        }}
      />

      {/* Reject Dialog */}
      <RejectRequestDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        batchId={batchId}
        target={rejectTarget}
        onSuccess={() => {
          setRejectTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function ApproveRequestDialog({
  open,
  onOpenChange,
  batchId,
  target,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  target: PendingMoveRequestItem | null;
  onSuccess: () => void;
}) {
  const [notes, setNotes] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  if (!target) return null;

  function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const result = await approveMoveRequestAction({
        batchId,
        requestId: target!.id,
        notes: notes.trim() || undefined,
      });

      if (result.ok) {
        toast.success(
          `Approved move for ${target!.name} to ${target!.requestedPaceGroupName}`,
        );
        onSuccess();
        onOpenChange(false);
        return;
      }

      setFormError(
        result.errors?.formErrors?.[0] ?? 'Could not approve move request.',
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve pace group move</DialogTitle>
          <DialogDescription>
            Confirm moving {target.name} from{' '}
            {target.currentPaceGroupName ?? 'unplaced'} to{' '}
            <span className="font-semibold text-foreground">
              {target.requestedPaceGroupName}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleApprove} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
              {formError}
            </div>
          )}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="approve-notes">
                Approval notes{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </FieldLabel>
              <Textarea
                id="approve-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional internal note regarding this approval..."
                rows={2}
                disabled={isPending}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Approving…' : 'Confirm approval'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RejectRequestDialog({
  open,
  onOpenChange,
  batchId,
  target,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  target: PendingMoveRequestItem | null;
  onSuccess: () => void;
}) {
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  if (!target) return null;

  function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const result = await rejectMoveRequestAction({
        batchId,
        requestId: target!.id,
        rejectionReason: rejectionReason.trim() || undefined,
      });

      if (result.ok) {
        toast.success(`Move request for ${target!.name} rejected`);
        onSuccess();
        onOpenChange(false);
        return;
      }

      setFormError(
        result.errors?.formErrors?.[0] ?? 'Could not reject move request.',
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject pace group move</DialogTitle>
          <DialogDescription>
            Decline {target.name}&apos;s request to move to{' '}
            {target.requestedPaceGroupName}. Their current membership will
            remain unchanged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleReject} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
              {formError}
            </div>
          )}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reject-reason">
                Reason for rejection{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </FieldLabel>
              <Input
                id="reject-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Group is at capacity, please discuss with batch admin"
                disabled={isPending}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? 'Rejecting…' : 'Reject request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
