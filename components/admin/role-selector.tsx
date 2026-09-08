"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { updateProfileRoleAction } from "@/actions/admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roleLabels, type AdminRole } from "@/lib/services/constants/admin-constants";

export function RoleSelector({
  profileId,
  name,
  roleOrder,
  role,
}: {
  profileId: string;
  name: string;
  roleOrder: AdminRole[];
  role: AdminRole;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={role}
      disabled={isPending}
      onValueChange={(nextRole) => {
        startTransition(async () => {
          const result = await updateProfileRoleAction({
            profileId,
            role: nextRole,
          });
          if (result.ok) {
            toast.success(
              `${name} is now ${roleLabels[nextRole as AdminRole]}`,
            );
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      <SelectTrigger className="ml-auto w-[190px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roleOrder.map((option) => (
          <SelectItem key={option} value={option}>
            {roleLabels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
