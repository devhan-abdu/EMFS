"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send, X } from "lucide-react";

import { createMembershipAction } from "@/actions/membership";
import { Button } from "@/components/ui/button";

type ApplicationStatus = "pending" | "approved" | "handoff" | "rejected";

export function ApplicationRowActions({
  status,
  name,
  profileId,
  batchId,
}: {
  status: ApplicationStatus;
  name: string;
  profileId: string;
  batchId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (status === "pending") {
    const review = (membershipStatus: "approved" | "rejected") => {
      startTransition(async () => {
        const result = await createMembershipAction({
          profileId,
          batchId,
          status: membershipStatus,
        });

        if (result.ok) {
          toast.success(
            membershipStatus === "approved" ?
              `${name} approved`
            : `${name} declined`,
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

  if (status === "approved") {
    return (
      <Button size="sm" variant="outline" disabled={isPending}>
        <Send className="size-4" />
        Remind handoff
      </Button>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">No action needed</span>
  );
}
