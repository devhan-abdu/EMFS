"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth/authorize";
import type { AdminRole } from "@/lib/services/constants/admin-constants";

const roles: AdminRole[] = [
  "super_admin",
  "batch_admin",
  "pace_admin",
  "member",
];

export async function updateProfileRoleAction(input: unknown) {
  await requireSuperAdmin();

  if (!input || typeof input !== "object") {
    return { ok: false as const, error: "Invalid role update." };
  }

  const { profileId, role } = input as { profileId?: unknown; role?: unknown };
  if (
    typeof profileId !== "string" ||
    typeof role !== "string" ||
    !roles.includes(role as AdminRole)
  ) {
    return { ok: false as const, error: "Invalid profile or role." };
  }

  await db
    .update(profiles)
    .set({ role: role as AdminRole, updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  revalidatePath("/roles");
  return { ok: true as const };
}
