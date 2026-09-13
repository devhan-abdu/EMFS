"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { joinWaitlistAction } from "@/actions/waitlist";
import { Button } from "@/components/ui/button";

export function JoinWaitlistButton({ batchId }: { batchId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await joinWaitlistAction({ batchId });
          if (result.ok) {
            toast.success("Added to the waiting list");
            router.refresh();
          } else {
            toast.error(
              result.errors.formErrors[0] ?? "Could not join the waiting list",
            );
          }
        })
      }
    >
      {isPending ? "Joining…" : "Join waiting list"}
    </Button>
  );
}
