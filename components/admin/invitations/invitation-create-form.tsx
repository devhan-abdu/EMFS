'use client';

import { useActionState, useEffect, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import {
  createInvitationAction,
  type InvitationActionState,
} from '@/actions/invitations';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';

type InvitationOptionData = {
  batches: { id: string; name: string }[];
  paceGroups: { id: string; name: string; batchId: string }[];
};

const initialState: InvitationActionState = null;

export function InvitationCreateForm({
  options,
}: {
  options: InvitationOptionData;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createInvitationAction,
    initialState,
  );
  const [role, setRole] = useState('member');
  const [batchId, setBatchId] = useState('');
  const fieldErrors = state?.errors?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.ok) {
      toast.success('Invitation created. Copy the links below.');
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            Create invitation
          </CardTitle>
          <CardDescription>
            Invitation links expire after seven days and can be accepted once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address (optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                disabled={pending}
              />
              {fieldErrors.email?.[0] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.email[0]}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                name="role"
                value={role}
                onValueChange={(value) => setRole(value ?? 'member')}
                disabled={pending}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="pace_admin">Pace admin</SelectItem>
                  <SelectItem value="batch_admin">Batch admin</SelectItem>
                  <SelectItem value="super_admin">Super admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === 'batch_admin' ||
            role === 'pace_admin' ||
            role === 'member' ? (
              <div className="grid gap-2">
                <Label htmlFor="batchId">
                  Batch{role === 'member' ? ' (optional)' : ''}
                </Label>
                <Select
                  name="batchId"
                  value={batchId}
                  onValueChange={(value) => setBatchId(value ?? '')}
                  disabled={pending}
                >
                  <SelectTrigger id="batchId">
                    <SelectValue placeholder="Choose a batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.batches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.batchId?.[0] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.batchId[0]}
                  </p>
                ) : null}
              </div>
            ) : (
              <input type="hidden" name="batchId" value="" />
            )}

            {role === 'pace_admin' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="paceGroupId">Pace group</Label>
                  <Select name="paceGroupId" disabled={pending || !batchId}>
                    <SelectTrigger id="paceGroupId">
                      <SelectValue placeholder="Choose a pace group" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.paceGroups
                        .filter((group) => group.batchId === batchId)
                        .map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.paceGroupId?.[0] ? (
                    <p className="text-sm text-destructive">
                      {fieldErrors.paceGroupId[0]}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paceDuty">Duty</Label>
                  <Select name="paceDuty" disabled={pending}>
                    <SelectTrigger id="paceDuty">
                      <SelectValue placeholder="Choose a duty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reflection">Reflection</SelectItem>
                      <SelectItem value="inspiration">Inspiration</SelectItem>
                      <SelectItem value="attendance">Attendance</SelectItem>
                      <SelectItem value="daily_task">Daily task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <input type="hidden" name="paceGroupId" value="" />
                <input type="hidden" name="paceDuty" value="" />
              </>
            )}

            {state?.errors?.formErrors?.length ? (
              <p role="alert" className="text-sm text-destructive">
                {state.errors.formErrors[0]}
              </p>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create invitation'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {state?.ok && state.data ? (
        <Card className="card-soft h-fit">
          <CardHeader>
            <CardTitle className="font-display text-xl">
              Invitation links
            </CardTitle>
            <CardDescription>
              Expires {new Date(state.data.expiresAt).toLocaleString()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <InvitationLink label="Web invitation" href={state.data.webUrl} />
            <InvitationLink
              label="Telegram Mini App"
              href={state.data.telegramUrl}
            />
            <InvitationLink
              label="Telegram bot fallback"
              href={state.data.telegramBotUrl}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function InvitationLink({ label, href }: { label: string; href: string }) {
  async function copyLink() {
    await navigator.clipboard.writeText(href);
    toast.success(`${label} copied`);
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="break-all text-xs text-muted-foreground">{href}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copyLink}>
          <Copy className="size-4" />
          Copy link
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={href} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Open
          </a>
        </Button>
      </div>
    </div>
  );
}
