'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { dutyLabels } from './duty-labels';
import type { PaceAdminDuty } from '@/db/schema/pace-admin-assignments';

/**
 * UI-only preview. There is no volunteer-request table or service — this
 * panel is not wired to the backend.
 */
type MockVolunteer = {
  id: string;
  name: string;
  group: string;
  appliedOn: string;
  duties: PaceAdminDuty[];
};

const mockVolunteers: MockVolunteer[] = [
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

export function VolunteerRequestsPanel({ batchName }: { batchName: string }) {
  const [handled, setHandled] = useState<
    Record<string, 'approved' | 'rejected'>
  >({});

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
      <p className="text-xs text-muted-foreground">
        Preview only — volunteer requests aren&apos;t wired to the backend yet.
      </p>
      {mockVolunteers.map((request) => {
        const state = handled[request.id];
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
              {state ? (
                <Badge variant={state === 'approved' ? 'default' : 'outline'}>
                  {state === 'approved' ? 'Approved' : 'Rejected'}
                </Badge>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setHandled((h) => ({ ...h, [request.id]: 'approved' }));
                      toast.success(
                        `${request.name} confirmed as pace admin (preview only)`,
                      );
                    }}
                  >
                    <Check className="size-3.5" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHandled((h) => ({ ...h, [request.id]: 'rejected' }));
                      toast(
                        `${request.name}'s request was declined (preview only)`,
                      );
                    }}
                  >
                    <X className="size-3.5" />
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
