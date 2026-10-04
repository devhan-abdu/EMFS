'use client';

import { useActionState, useState } from 'react';

import {
  updateSuperAdminAccessAction,
  type SuperAdminAccessActionState,
} from '@/actions/admin';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export function SuperAdminToggle({
  profileId,
  name,
  isSuperAdmin,
}: {
  profileId: string;
  name: string;
  isSuperAdmin: boolean;
}) {
  const [enabled, setEnabled] = useState(isSuperAdmin);
  const [state, formAction, isPending] = useActionState<
    SuperAdminAccessActionState,
    FormData
  >(updateSuperAdminAccessAction, null);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="isSuperAdmin" value={String(enabled)} />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={isPending}
          aria-label={`Global super-admin access for ${name}`}
        />
        {enabled ? 'Enabled' : 'Disabled'}
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        Save
      </Button>
      {state && !state.ok ? (
        <span role="alert" className="text-sm text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
