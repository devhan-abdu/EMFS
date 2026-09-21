'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { batches } from '@/db/schema';
import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';

export async function toggleRegistrationAction(input: {
  batchId: string;
  open: boolean;
}) {
  if (!input?.batchId || typeof input.open !== 'boolean') {
    return {
      ok: false as const,
      errors: { formErrors: ['Invalid request.'], fieldErrors: {} },
    };
  }

  try {
    await requireBatchAccess(input.batchId);

    await db
      .update(batches)
      .set({ registrationOpen: input.open, updatedAt: new Date() })
      .where(eq(batches.id, input.batchId));

    revalidatePath(`/admin/batches/${input.batchId}`);
    revalidatePath('/admin/batches');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    return {
      ok: false as const,
      errors: {
        formErrors: ['An unexpected error occurred.'],
        fieldErrors: {},
      },
    };
  }
}
