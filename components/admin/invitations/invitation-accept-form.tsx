'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  acceptInvitationAction,
  type AcceptInvitationActionState,
} from '@/actions/invitations';
import { Button } from '@/components/ui/button';

const initialState: AcceptInvitationActionState = null;

export function InvitationAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    initialState,
  );

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Accepting…' : 'Accept invitation'}
      </Button>
    </form>
  );
}
