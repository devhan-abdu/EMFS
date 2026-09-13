import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { requireSession } from "@/lib/auth/authorize";
import { getBatchForApplication } from "@/lib/services/batches/get-batch-for-application";
import { PageHeader } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApplicationForm } from "@/components/member/application-form";
import { JoinWaitlistButton } from "@/components/member/join-waitlist-button";

export const metadata: Metadata = {
  title: "Apply — EMFSC Book Shelf",
  description: "Apply to an EMFSC reading batch and join the circle.",
  openGraph: {
    title: "Apply — EMFSC Book Shelf",
    description: "Apply to join an EMFSC reading batch.",
  },
};

type ApplyPageProps = { params: Promise<{ batchId: string }> };

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { batchId } = await params;

  let currentUser;
  try {
    currentUser = await requireSession();
  } catch {
    redirect(`/signin?next=${encodeURIComponent(`/apply/${batchId}`)}`);
  }

  const { batch, hasSelectablePaceGroups, existingMembership } =
    await getBatchForApplication(batchId, currentUser.profile.id);

  if (!batch) {
    return (
      <div className="space-y-6">
        <PageHeader title="Batch not found" />
        <p className="text-sm text-muted-foreground">
          This batch may have been removed or the link is incorrect.
        </p>
      </div>
    );
  }

  if (existingMembership) {
    const sameBatch = existingMembership.batchId === batchId;
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={batch.name}
          title={
            sameBatch ? "You've already applied" : "You're already in a batch"
          }
          description={
            sameBatch ?
              "You already have an application or membership for this batch."
            : "You can only be part of one batch at a time. Check your current batch status first."
          }
        />
        <Button asChild>
          <Link href="/me">Go to your status</Link>
        </Button>
      </div>
    );
  }

  if (!batch.registrationOpen) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={batch.name}
          title="Registration is closed"
          description="This batch isn't accepting new applications right now. Join the waiting list to be notified when a seat opens or a new batch starts."
        />
        <Card className="card-soft">
          <CardContent className="p-6">
            <JoinWaitlistButton batchId={batch.id} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={batch.name}
        title="Apply to join"
        description="Share a few details so we can contact you and confirm your place in this batch."
      />
      <Card className="card-soft">
        <CardContent className="p-6">
          <ApplicationForm
            batchId={batch.id}
            showPacePreference={hasSelectablePaceGroups}
            defaultEmail={currentUser.email}
          />
        </CardContent>
      </Card>
    </div>
  );
}
