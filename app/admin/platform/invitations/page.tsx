import type { Metadata } from 'next';

import { InvitationCreateForm } from '@/components/admin/invitations/invitation-create-form';
import { PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { requireSuperAdmin } from '@/lib/auth/authorize';
import {
  getInvitationOptions,
  listInvitations,
} from '@/lib/services/invitations';

export const metadata: Metadata = {
  title: 'Invitations — EMFSC Book Shelf Admin',
  description: 'Create and track secure role invitations.',
};

export default async function InvitationsPage() {
  await requireSuperAdmin();
  const [invitations, options] = await Promise.all([
    listInvitations(),
    getInvitationOptions(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform access"
        title="Invitations"
        description="Issue time-limited invitations for members and scoped admin roles."
      />

      <InvitationCreateForm options={options} />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Recent invitations
        </h2>
        {invitations.length ? (
          <div className="grid gap-3">
            {invitations.map((invitation) => {
              const expired = invitation.expiresAt <= new Date();
              const status = invitation.usedAt
                ? 'Accepted'
                : expired
                  ? 'Expired'
                  : 'Pending';
              return (
                <Card key={invitation.id} className="card-soft">
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                    <div className="grid gap-1">
                      <p className="font-medium text-foreground">
                        {invitation.email ?? 'Any email'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {invitation.role.replaceAll('_', ' ')}
                        {invitation.batchName
                          ? ` · ${invitation.batchName}`
                          : ''}
                        {invitation.paceGroupName
                          ? ` · ${invitation.paceGroupName}`
                          : ''}
                        {invitation.paceDuty
                          ? ` · ${invitation.paceDuty.replaceAll('_', ' ')}`
                          : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires {invitation.expiresAt.toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                      {status}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No invitations have been created.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Showing up to 100 most recent invitations. Invitation tokens are only
          shown when first created and are never stored in plain text.
        </p>
      </section>
    </div>
  );
}
