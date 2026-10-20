'use server';

import { revalidatePath } from 'next/cache';

import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';
import {
  BatchError,
  updateBatchRegistration,
} from '@/lib/services/batches/batch';

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

    await updateBatchRegistration(input.batchId, input.open);

    revalidatePath(`/admin/b/${input.batchId}`);
    revalidatePath('/admin/platform/batches');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        error: e.code,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (e instanceof BatchError) {
      return {
        ok: false as const,
        error: e.code,
        errors: { formErrors: [e.code], fieldErrors: {} },
      };
    }
    return {
      ok: false as const,
      error: 'UNEXPECTED_ERROR',
      errors: {
        formErrors: ['An unexpected error occurred.'],
        fieldErrors: {},
      },
    };
  }
}
