'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { toggleRegistrationAction } from '@/actions/batch-toggle';
import { Switch } from '@/components/ui/switch';

const ERROR_MESSAGES: Record<string, string> = {
  NO_BATCH_ADMIN:
    'Cannot open registration: at least one batch admin must be assigned.',
  NO_PACE_GROUP:
    'Cannot open registration: at least one non-archived pace group is required.',
  BATCH_FULL:
    'Cannot open registration: the batch is currently at maximum capacity.',
};

export function RegistrationToggle({
  batchId,
  initialOpen,
}: {
  batchId: string;
  initialOpen: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Switch
      checked={open}
      disabled={isPending}
      onCheckedChange={(next) => {
        setOpen(next);
        startTransition(async () => {
          const result = await toggleRegistrationAction({
            batchId,
            open: next,
          });
          if (result.ok) {
            toast.success(next ? 'Registration opened' : 'Registration closed');
            router.refresh();
          } else {
            setOpen(!next);
            const errorCode =
              ('error' in result && typeof result.error === 'string'
                ? result.error
                : undefined) ?? result.errors.formErrors[0];
            const message =
              (errorCode && ERROR_MESSAGES[errorCode]) ||
              errorCode ||
              'Could not update registration';
            toast.error(message);
          }
        });
      }}
    />
  );
}
