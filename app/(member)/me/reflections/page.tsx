import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requireSession } from '@/lib/auth/authorize';
import { getMemberHomeState } from '@/lib/services/member/get-member-home-state';
import { PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { ReflectionsClient } from '@/components/member/reflections-client';

export const metadata: Metadata = {
  title: 'Reflections — EMFSC Book Shelf',
  description: 'Share and read weekly reflections with your pace group.',
  openGraph: {
    title: 'Reflections — EMFSC Book Shelf',
    description: 'Weekly reflections with your EMFSC pace group.',
  },
};

export default async function ReflectionsPage() {
  let currentUser;
  try {
    currentUser = await requireSession();
  } catch {
    redirect('/signin?next=/me/reflections');
  }

  const state = await getMemberHomeState(currentUser.profile.id);

  if (state.kind === 'active_awaiting_placement') {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={state.batchName}
          title="You are accepted into this batch. Your pace group will be assigned soon."
        />
        <Card className="card-soft">
          <CardContent className="p-6 text-sm text-muted-foreground">
            You are accepted into this batch. Your pace group will be assigned
            soon.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.kind !== 'active_placed') {
    redirect('/me');
  }

  return (
    <ReflectionsClient
      batchName={state.batchName}
      paceGroupName={state.paceGroupName}
    />
  );
}
