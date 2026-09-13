"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Send, X } from "lucide-react";

import { reviewApplicationAction } from "@/actions/application-review";
import { Button } from "@/components/ui/button";

export type ApplicationRowStatus =
  | "pending"
  | "approved_pending_handoff"
  | "active"
  | "rejected";

export function ApplicationRowActions({
  status,
  name,
  applicationId,
  handoffBotLink,
}: {
  status: ApplicationRowStatus;
  name: string;
  applicationId: string;
  handoffBotLink?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (status === "pending") {
    const review = (decision: "approved" | "rejected") => {
      startTransition(async () => {
        const result = await reviewApplicationAction({
          applicationId,
          decision,
        });

        if (result.ok) {
          toast.success(
            decision === "approved" ? `${name} approved` : `${name} declined`,
          );
          router.refresh();
        } else {
          toast.error(
            result.errors.formErrors[0] ?? "Could not update application",
          );
        }
      });
    };

    return (
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => review("approved")}
        >
          <Check className="size-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          aria-label={`Decline ${name}`}
          onClick={() => review("rejected")}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  if (status === "approved_pending_handoff") {
    return <HandoffReminder link={handoffBotLink ?? null} />;
  }

  return (
    <span className="text-xs text-muted-foreground">No action needed</span>
  );
}

function HandoffReminder({ link }: { link: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!link) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Send className="size-4" />
        Remind handoff
      </Button>
    );
  }

  async function copyLink() {
    try {
      if(!link) return
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Bot link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="ghost"
        aria-label="Copy bot link"
        onClick={copyLink}
      >
        {copied ?
          <Check className="size-4" />
        : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
