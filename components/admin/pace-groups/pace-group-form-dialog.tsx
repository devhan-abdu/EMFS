'use client';

import * as React from 'react';
import { toast } from 'sonner';

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
import { PACE_GROUP_SIZE_PRESETS } from '@/lib/validations/pace-group';
import {
  createPaceGroupAction,
  updatePaceGroupAction,
} from '@/actions/pace-group';
import type { PaceGroupWithAdmins } from './types';

export function PaceGroupFormDialog({
  open,
  onOpenChange,
  batchId,
  initial,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  initial: PaceGroupWithAdmins | null;
  onSuccess: () => void;
}) {
  const isEdit = Boolean(initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit pace group' : 'Create pace group'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the name or daily page pace for this group.'
              : 'This group will live inside the current batch.'}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <PaceGroupForm
            key={initial?.id ?? 'create'}
            batchId={batchId}
            initial={initial}
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaceGroupForm({
  batchId,
  initial,
  onSuccess,
  onClose,
}: {
  batchId: string;
  initial: PaceGroupWithAdmins | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const isEdit = Boolean(initial);
  const [name, setName] = React.useState(initial?.name ?? '');
  const [size, setSize] = React.useState(String(initial?.size ?? 10));
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updatePaceGroupAction({
            paceGroupId: initial!.id,
            name,
            size: Number(size),
          })
        : await createPaceGroupAction({
            batchId,
            name,
            size: Number(size),
          });

      if (result.ok) {
        toast.success(isEdit ? 'Pace group updated' : 'Pace group created');
        onSuccess();
        onClose();
        return;
      }

      if (result.errors?.fieldErrors) {
        setFieldErrors(result.errors.fieldErrors as Record<string, string[]>);
      }
      setFormError(result.errors?.formErrors?.[0] ?? null);
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {formError && (
        <p className="text-xs font-medium text-destructive">{formError}</p>
      )}

      <FieldGroup>
        {/* Group Name */}
        <Field data-invalid={!!fieldErrors.name?.length}>
          <FieldLabel htmlFor="pg-name">Group name</FieldLabel>
          <Input
            id="pg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nur · 10 pages"
            disabled={isPending}
            aria-invalid={!!fieldErrors.name?.length}
          />
          {fieldErrors.name?.[0] && (
            <FieldError>{fieldErrors.name[0]}</FieldError>
          )}
        </Field>

        {/* Pages Per Day */}
        <Field data-invalid={!!fieldErrors.size?.length}>
          <FieldLabel htmlFor="pg-size">Pages a day</FieldLabel>
          <Select
            value={size}
            onValueChange={(v) => setSize(v ?? '10')}
            disabled={isPending}
          >
            <SelectTrigger id="pg-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PACE_GROUP_SIZE_PRESETS.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p} pages
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.size?.[0] && (
            <FieldError>{fieldErrors.size[0]}</FieldError>
          )}
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create group'}
        </Button>
      </DialogFooter>
    </form>
  );
}
