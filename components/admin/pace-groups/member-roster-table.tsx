'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PaceGroupWithAdmins } from './types';
import { buildMockRoster } from './mock-roster';

/**
 * UI-only preview. There is no placeMemberAction / moveMemberAction /
 * getBatchRoster service yet, so this uses local mock data and toasts
 * instead of real mutations. Wire this up once that service lands.
 */
type MockMember = {
  id: string;
  name: string;
  email: string;
  pacePreference: string | null;
  placement: 'awaiting_placement' | 'assigned';
  paceGroup: string | null;
};

export function MemberRosterTable({
  batchName,
  paceGroups,
}: {
  batchName: string;
  paceGroups: PaceGroupWithAdmins[];
}) {
  const [members] = useState<MockMember[]>(() => buildMockRoster(paceGroups));
  const awaiting = members.filter((m) => m.placement === 'awaiting_placement');

  return (
    <div className="space-y-6">
      <Card className="card-soft">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-foreground">
              {awaiting.length} awaiting pace-group placement
            </p>
            <p className="text-sm text-muted-foreground">
              Preview only — placement isn&apos;t wired to the backend yet.
            </p>
          </div>
          <Button
            disabled={awaiting.length === 0 || paceGroups.length === 0}
            onClick={() =>
              toast.success(
                `${awaiting.length} members placed in ${batchName} (preview only)`,
              )
            }
          >
            <UserPlus className="size-4" />
            Place all unassigned
          </Button>
        </CardContent>
      </Card>

      <Card className="card-soft overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
              <TableHead className="py-4 pl-6">Member</TableHead>
              <TableHead>Pace preference</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Pace group</TableHead>
              <TableHead className="pr-6 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id} className="hover:bg-accent/40">
                <TableCell className="py-4 pl-6">
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.pacePreference ?? 'Not collected'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      member.placement === 'assigned' ? 'default' : 'outline'
                    }
                  >
                    {member.placement === 'assigned' ? 'Placed' : 'Awaiting'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.paceGroup ?? '—'}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paceGroups.length === 0}
                    onClick={() =>
                      toast.success(
                        member.placement === 'assigned'
                          ? `${member.name} moved (preview only)`
                          : `${member.name} placed (preview only)`,
                      )
                    }
                  >
                    <UserPlus className="size-3.5" />
                    {member.placement === 'assigned'
                      ? 'Move group'
                      : 'Place in group'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
