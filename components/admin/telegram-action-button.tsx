'use client';

import { useActionState } from 'react';

import type { TelegramActionState } from '@/actions/telegram';
import { Button } from '@/components/ui/button';

export function TelegramActionButton({
  action,
  batchId,
  label,
  pendingLabel,
  variant = 'default',
  confirmMessage,
  disabled = false,
}: {
  action: (
    prev: TelegramActionState,
    formData: FormData,
  ) => Promise<TelegramActionState>;
  batchId: string;
  label: string;
  pendingLabel: string;
  variant?: 'default' | 'outline' | 'destructive';
  confirmMessage?: string;
  disabled?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="batchId" value={batchId} />
      <Button
        type="submit"
        variant={variant}
        disabled={disabled || isPending}
        onClick={(event) => {
          if (confirmMessage && !window.confirm(confirmMessage)) {
            event.preventDefault();
          }
        }}
      >
        {isPending ? pendingLabel : label}
      </Button>
      {state?.ok && state.message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      ) : null}
      {state && !state.ok && state.errors?.formErrors[0] ? (
        <p role="alert" className="text-sm text-destructive">
          {state.errors.formErrors[0]}
        </p>
      ) : null}
    </form>
  );
}
