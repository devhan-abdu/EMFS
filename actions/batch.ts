'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/authorize';
import { createBatchSchema } from '@/lib/validations/batch';
import {
  createBatch,
  BatchError,
  type CreateBatchResult,
} from '@/lib/services/batches/batch';

export type CreateBatchActionState = {
  ok: boolean;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
  data?: CreateBatchResult;
} | null;

export async function createBatchAction(
  _prevState: CreateBatchActionState,
  formData: FormData,
): Promise<CreateBatchActionState> {
  const currentUser = await requireRole(['super_admin']);

  const adminIds = formData
    .getAll('adminIds')
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

  const parseNumber = (val: FormDataEntryValue | null): number | undefined => {
    if (val === null || val === '') return undefined;

    const num = Number(val);

    return Number.isNaN(num) ? undefined : num;
  };

  const raw = {
    name: formData.get('name'),
    maxMembers: parseNumber(formData.get('maxMembers')),
    paceGroupCount: parseNumber(formData.get('paceGroupCount')),
    startDate: formData.get('startDate') || undefined,
    readingDaysPerWeek: parseNumber(formData.get('readingDaysPerWeek')),
    registrationOpen: formData.get('registrationOpen') === 'true',
    ...(adminIds.length > 0 ? { adminIds } : {}),
  };

  const parsed = createBatchSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  let result: CreateBatchResult;

  try {
    result = await createBatch(currentUser.profile.id, parsed.data);
  } catch (e) {
    if (e instanceof BatchError) {
      return {
        ok: false,
        errors: {
          formErrors: [e.message],
          fieldErrors: {},
        },
      };
    }

    return {
      ok: false,
      errors: {
        formErrors: [e instanceof Error ? e.message : 'Something went wrong'],
        fieldErrors: {},
      },
    };
  }

  revalidatePath('/admin/batches');
  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/batches');

  return {
    ok: true,
    data: result,
  };
}
