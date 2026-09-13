"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { batches } from "@/db/schema";
import { requireRole } from "@/lib/auth/authorize";

export async function toggleRegistrationAction(input: {
  batchId: string;
  open: boolean;
}) {
  await requireRole(["batch_admin", "super_admin"]);

  if (!input?.batchId || typeof input.open !== "boolean") {
    return {
      ok: false as const,
      errors: { formErrors: ["Invalid request."], fieldErrors: {} },
    };
  }

  await db
    .update(batches)
    .set({ registrationOpen: input.open, updatedAt: new Date() })
    .where(eq(batches.id, input.batchId));

  revalidatePath(`/admin/batches/${input.batchId}`);
  revalidatePath("/admin/batches");
  return { ok: true as const };
}
