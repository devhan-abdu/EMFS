'use server';

import { revalidatePath } from 'next/cache';

import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';
import {
  toggleBatchRegistration,
  BatchError,
} from '@/lib/services/batches/batch';
import { toggleRegistrationSchema } from '@/lib/validations/batch';

export async function toggleRegistrationAction(input: {
  batchId: string;
  open: boolean;
}) {
  const parsed = toggleRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: {
        formErrors: ['Invalid request.'],
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireBatchAccess(parsed.data.batchId);

    await toggleBatchRegistration(parsed.data.batchId, parsed.data.open);

    revalidatePath(`/admin/b/${parsed.data.batchId}`);
    revalidatePath('/admin/platform/batches');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false as const,
        errors: { formErrors: [e.message], fieldErrors: {} },
      };
    }
    if (e instanceof BatchError) {
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
