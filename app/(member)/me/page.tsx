import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Send } from "lucide-react";

import { requireSession } from "@/lib/auth/authorize";
import { getMemberHomeState } from "@/lib/services/member/get-member-home-state";
import { PageHeader } from "@/components/shared/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Today's reading — EMFSC Book Shelf",
  description:
    "Your pages for today, your reading streak and this week's rhythm with your EMFSC pace group.",
  openGraph: {
    title: "Today's reading — EMFSC Book Shelf",
    description: "Today's pages, your streak and this week's reading rhythm.",
  },
};

export default async function MeHomePage() {
  let currentUser;
  try {
    currentUser = await requireSession();
  } catch {
    redirect("/signin?next=/me");
  }

  const state = await getMemberHomeState(currentUser.profile.id);

  switch (state.kind) {
    case "no_batch":
      return (
        <div className="space-y-6">
          <PageHeader
            title="You're not in a batch yet"
            description="Browse open batches and apply to start reading with a circle."
          />
          <Button asChild>
            <Link href="/batches">Browse open batches</Link>
          </Button>
        </div>
      );

    case "waitlisted":
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={state.batchName}
            title="You're on the waiting list"
          />
          <Card className="card-soft">
            <CardContent className="p-6 text-sm text-foreground">
              You&apos;re position{" "}
              <span className="font-semibold tabular-nums">
                {state.queuePosition}
              </span>{" "}
              in line. We&apos;ll notify you in-app when a seat opens.
            </CardContent>
          </Card>
        </div>
      );

    case "applied":
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={state.batchName}
            title="Application under review"
          />
          <Card className="card-soft">
            <CardContent className="p-6 text-sm text-muted-foreground">
              A batch admin will approve or decline your application —
              you&apos;ll see the update here.
            </CardContent>
          </Card>
        </div>
      );

    case "rejected":
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={state.batchName}
            title="Application not accepted"
            description="This application wasn't accepted this time."
          />
          <Button asChild variant="outline">
            <Link href="/batches">Browse other open batches</Link>
          </Button>
        </div>
      );

    case "approved_pending_handoff":
      return (
        <div className="space-y-6">
          <PageHeader eyebrow={state.batchName} title="One step left" />
          <Card className="card-soft border-l-4 border-l-gold bg-gold/10">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm font-medium text-foreground">
                You&apos;re approved for {state.batchName}!
              </p>
              <p className="text-sm text-muted-foreground">
                Open the Telegram bot to link your account and activate your
                membership.
              </p>
              {state.telegramStartLink ?
                <Button asChild className="w-full">
                  <a
                    href={state.telegramStartLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Send className="size-4" />
                    Finish joining — open Telegram
                  </a>
                </Button>
              : <p className="text-xs text-muted-foreground">
                  Contact your batch admin for a new handoff link.
                </p>
              }
            </CardContent>
          </Card>
        </div>
      );

    case "active_awaiting_placement":
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={state.batchName}
            title="You're in!"
            description="Your pace group will be assigned soon — daily pages and attendance unlock once you're placed."
          />
        </div>
      );

    case "active_placed":
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={state.batchName}
            title="Today's reading"
            description="Daily reading tools are on the way."
          />
        </div>
      );
  }
}
