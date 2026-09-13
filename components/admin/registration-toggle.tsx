"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { toggleRegistrationAction } from "@/actions/batch-toggle";
import { Switch } from "@/components/ui/switch";

export function RegistrationToggle({
  batchId,
  initialOpen,
}: {
  batchId: string;
  initialOpen: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Switch
      checked={open}
      disabled={isPending}
      onCheckedChange={(next) => {
        setOpen(next);
        startTransition(async () => {
          const result = await toggleRegistrationAction({
            batchId,
            open: next,
          });
          if (result.ok) {
            toast.success(next ? "Registration opened" : "Registration closed");
            router.refresh();
          } else {
            setOpen(!next);
            toast.error(
              result.errors.formErrors[0] ?? "Could not update registration",
            );
          }
        });
      }}
    />
  );
}
