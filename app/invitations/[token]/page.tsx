import Link from 'next/link';
import type { Metadata } from 'next';

import { InvitationAcceptForm } from '@/components/admin/invitations/invitation-accept-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';
import { getInvitationPreview } from '@/lib/services/invitations';

export const metadata: Metadata = {
  title: 'Accept invitation — EMFSC Book Shelf',
  robots: { index: false, follow: false },
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const currentUser = await getCurrentUser();
  const preview = await getInvitationPreview(token, currentUser?.email);
  const next = `/invitations/${encodeURIComponent(token)}`;

  if (preview.status !== 'ready') {
    const message = {
      invalid: 'This invitation link is invalid.',
      expired: 'This invitation has expired. Ask the inviter for a new link.',
      used: 'This invitation has already been accepted.',
      email_mismatch:
        'This invitation is for a different email address. Sign in with the invited account.',
    }[preview.status];

    return (
      <InvitationFrame title="Invitation unavailable">
        <p className="text-sm text-muted-foreground">{message}</p>
        {preview.status === 'email_mismatch' ? (
          <Button asChild className="mt-4">
            <Link href={`/signin?next=${encodeURIComponent(next)}`}>
              Switch account
            </Link>
          </Button>
        ) : null}
      </InvitationFrame>
    );
  }

  if (!currentUser) {
    return (
      <InvitationFrame title="You’re invited">
        <p className="text-sm text-muted-foreground">
          Sign in or create an account to accept your{' '}
          {preview.role.replaceAll('_', ' ')} invitation.
          {preview.email ? ` It is for ${preview.email}.` : ''}
        </p>
        <div className="mt-4 grid gap-2">
          <Button asChild>
            <Link href={`/signin?next=${encodeURIComponent(next)}`}>
              Sign in
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/signup?next=${encodeURIComponent(next)}`}>
              Create account
            </Link>
          </Button>
        </div>
      </InvitationFrame>
    );
  }

  return (
    <InvitationFrame title="Accept invitation">
      <p className="mb-4 text-sm text-muted-foreground">
        Accept the {preview.role.replaceAll('_', ' ')} invitation for{' '}
        {currentUser.email}.
      </p>
      <InvitationAcceptForm token={token} />
    </InvitationFrame>
  );
}

function InvitationFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="card-soft w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
