'use client';

import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

import {
  updateVolunteerRequestStatusAction,
  type VolunteerRequestActionState,
} from '@/actions/batch-settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PaceAdminDuty } from '@/db/schema/pace-admin-assignments';
import { dutyLabels } from './duty-labels';

type VolunteerRequest = {
  id: string;
  name: string;
  group: string;
  appliedOn: string;
  duties: PaceAdminDuty[];
};

const mockVolunteers: VolunteerRequest[] = [
  {
    id: 'v1',
    name: 'Ruwayda Mahdi',
    group: 'Nur · 10 pages',
    appliedOn: 'Sep 12',
    duties: ['reflection', 'attendance'],
  },
  {
    id: 'v2',
    name: 'Zeynab Ali',
    group: 'Sakina · 5 pages',
    appliedOn: 'Sep 10',
    duties: ['daily_task'],
  },
];

const initialState: VolunteerRequestActionState = null;

export function VolunteerRequestsPanel({
  batchId,
  batchName,
}: {
  batchId: string;
  batchName: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateVolunteerRequestStatusAction,
    initialState,
  );
  const latestDecision: Record<string, 'approved' | 'rejected'> =
    state?.ok && state.data ? { [state.data.id]: state.data.decision } : {};

  useEffect(() => {
    if (!state?.ok || !state.data) return;

    const request = mockVolunteers.find((item) => item.id === state.data?.id);
    if (!request) return;

    if (state.data.decision === 'approved') {
      toast.success(`${request.name} was approved as a pace admin.`);
      return;
    }

    toast(`${request.name}'s request was declined.`);
  }, [state]);

  if (mockVolunteers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-2 p-10 text-center">
        <p className="font-display text-lg font-semibold text-foreground">
          No volunteer requests
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Members who ask to help with a pace group in {batchName} will show up
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mockVolunteers.map((request) => {
        const decision = latestDecision[request.id] ?? undefined;

        return (
          <Card key={request.id} className="card-soft">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <p className="font-medium text-foreground">{request.name}</p>
                <p className="text-sm text-muted-foreground">
                  {request.group} · asked on {request.appliedOn}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {request.duties.map((duty) => (
                    <span
                      key={duty}
                      className="rounded-full bg-accent px-2 py-0.5 text-xs text-primary"
                    >
                      {dutyLabels[duty]}
                    </span>
                  ))}
                </div>
              </div>

              {decision ? (
                <Badge
                  variant={decision === 'approved' ? 'default' : 'outline'}
                >
                  {decision === 'approved' ? 'Approved' : 'Rejected'}
                </Badge>
              ) : (
                <div className="flex gap-2">
                  <form action={formAction} className="contents">
                    <input type="hidden" name="batchId" value={batchId} />
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <Button type="submit" size="sm" disabled={isPending}>
                      <Check className="size-3.5" />
                      Approve
                    </Button>
                  </form>

                  <form action={formAction} className="contents">
                    <input type="hidden" name="batchId" value={batchId} />
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                    >
                      <X className="size-3.5" />
                      Reject
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
