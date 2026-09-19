import { Metadata } from 'next';
import { Shield } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Pace Groups — EMFSC Book Shelf Admin',
  description:
    'Monitor member reading activity and manage daily page targets by role.',
};

export default function PaceGroupsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cohort Management"
        title="Pace Groups & Member Activity"
        description="Monitor daily reading progress, manage daily page targets, and review member activity based on your admin role."
      />

      {/* Role & Page Purpose Summary Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
            <Shield className="size-4" />
            Page Scope & Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            This page tracks member reading activity and sets daily page
            targets. Views and controls adapt based on your permission level:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-foreground">Super Admin:</strong> Full
              visibility across all batches, target approvals, and admin
              assignments.
            </li>
            <li>
              <strong className="text-foreground">Batch Admin:</strong> Manages
              pace groups and daily targets within their assigned batch.
            </li>
            <li>
              <strong className="text-foreground">Pace Group Admin:</strong>{' '}
              Tracks member daily logs and suggests page targets for their
              assigned group.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Static Dashboard Overview */}
    </div>
  );
}
