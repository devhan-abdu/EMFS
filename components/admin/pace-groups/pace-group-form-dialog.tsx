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
  createPaceGroupAction,
  updatePaceGroupAction,
} from '@/actions/pace-group';
import { createPaceGroupForDiscoveredTopicAction } from '@/actions/telegram';
import type { PaceGroupWithAdmins } from './types';

type PaceGroupFormState = {
  success: boolean;
  formError: string | null;
  fieldErrors: Record<string, string[]>;
};

export function PaceGroupFormDialog({
  open,
  onOpenChange,
  batchId,
  initial,
  discovery,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  initial: PaceGroupWithAdmins | null;
  discovery?: {
    id: string;
    topicName: string | null;
    messageThreadId: number;
  };
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
            {discovery
              ? `Create an EMFS pace group for ${discovery.topicName ? `“${discovery.topicName}”` : `Telegram topic #${discovery.messageThreadId}`}.`
              : isEdit
                ? 'Update the name or minimum and maximum pages per day.'
                : 'This group will live inside the current batch.'}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <PaceGroupForm
            key={initial?.id ?? 'create'}
            batchId={batchId}
            initial={initial}
            discovery={discovery}
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
  discovery,
  onSuccess,
  onClose,
}: {
  batchId: string;
  initial: PaceGroupWithAdmins | null;
  discovery:
    | {
        id: string;
        topicName: string | null;
        messageThreadId: number;
      }
    | undefined;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const isEdit = Boolean(initial);
  const [name, setName] = React.useState(initial?.name ?? '');
  const [minPages, setMinPages] = React.useState(
    String(initial?.min_pages ?? 10),
  );
  const [maxPages, setMaxPages] = React.useState(
    String(initial?.max_pages ?? 20),
  );
  const [state, formAction, isPending] = React.useActionState<
    PaceGroupFormState,
    FormData
  >(
    async (_previousState, formData) => {
      const input = {
        batchId,
        name: String(formData.get('name') ?? ''),
        min_pages: String(formData.get('min_pages') ?? ''),
        max_pages: String(formData.get('max_pages') ?? ''),
      };
      const result = isEdit
        ? await updatePaceGroupAction({
            ...input,
            paceGroupId: initial!.id,
          })
        : discovery
          ? await createPaceGroupForDiscoveredTopicAction({
              ...input,
              discoveryId: discovery.id,
            })
          : await createPaceGroupAction(input);

      return result.ok
        ? { success: true, formError: null, fieldErrors: {} }
        : {
            success: false,
            formError: result.errors?.formErrors?.[0] ?? null,
            fieldErrors: result.errors?.fieldErrors ?? {},
          };
    },
    { success: false, formError: null, fieldErrors: {} },
  );
  const fieldErrors = state.fieldErrors;
  const formError = state.formError;

  React.useEffect(() => {
    if (!state.success) return;
    toast.success(
      isEdit
        ? 'Pace group updated'
        : discovery
          ? 'Pace group created and topic connected'
          : 'Pace group created',
    );
    onSuccess();
    onClose();
  }, [discovery, isEdit, onClose, onSuccess, state.success]);

  return (
    <form className="space-y-4" action={formAction}>
      {formError && (
        <p className="text-xs font-medium text-destructive">{formError}</p>
      )}

      <FieldGroup>
        {/* Group Name */}
        <Field data-invalid={!!fieldErrors.name?.length}>
          <FieldLabel htmlFor="pg-name">Group name</FieldLabel>
          <Input
            id="pg-name"
            name="name"
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

        {/* Minimum Pages Per Day */}
        <Field data-invalid={!!fieldErrors.min_pages?.length}>
          <FieldLabel htmlFor="pg-min-pages">Minimum pages per day</FieldLabel>
          <Input
            id="pg-min-pages"
            name="min_pages"
            type="number"
            min="1"
            max={maxPages}
            value={minPages}
            onChange={(e) => setMinPages(e.target.value)}
            disabled={isPending}
            aria-invalid={!!fieldErrors.min_pages?.length}
          />
          {fieldErrors.min_pages?.[0] && (
            <FieldError>{fieldErrors.min_pages[0]}</FieldError>
          )}
        </Field>

        {/* Maximum Pages Per Day */}
        <Field data-invalid={!!fieldErrors.max_pages?.length}>
          <FieldLabel htmlFor="pg-max-pages">Maximum pages per day</FieldLabel>
          <Input
            id="pg-max-pages"
            name="max_pages"
            type="number"
            min="1"
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            disabled={isPending}
            aria-invalid={!!fieldErrors.max_pages?.length}
          />
          {fieldErrors.max_pages?.[0] && (
            <FieldError>{fieldErrors.max_pages[0]}</FieldError>
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
