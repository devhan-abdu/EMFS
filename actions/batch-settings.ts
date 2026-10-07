'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { batches } from '@/db/schema';
import { requireBatchAccess } from '@/lib/auth/authorize';
import {
  BATCH_WEEKDAYS,
  updateBatchCadenceSchema,
} from '@/lib/validations/batch-settings';

export type BatchCadenceActionState = {
  ok: boolean;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
  data?: {
    id: string;
    readingDaysPerWeek: number;
  } | null;
  fields?: {
    batchId?: string;
    readingDaysPerWeek?: number;
    readingDays?: string[];
    attendanceDays?: string[];
  };
} | null;

const normalizeWeekdays = (entries: FormDataEntryValue[]) =>
  entries.filter(
    (value): value is string =>
      typeof value === 'string' &&
      (BATCH_WEEKDAYS as readonly string[]).includes(value),
  );

export async function updateBatchCadenceAction(
  _prevState: BatchCadenceActionState,
  formData: FormData,
): Promise<BatchCadenceActionState> {
  const batchId = formData.get('batchId');
  const readingDaysPerWeek = formData.get('readingDaysPerWeek');
  const raw = {
    batchId: typeof batchId === 'string' ? batchId : undefined,
    readingDaysPerWeek:
      readingDaysPerWeek === null || readingDaysPerWeek === ''
        ? undefined
        : Number(readingDaysPerWeek),
    readingDays: normalizeWeekdays(formData.getAll('readingDays')),
    attendanceDays: normalizeWeekdays(formData.getAll('attendanceDays')),
  };

  const parsed = updateBatchCadenceSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
      fields: {
        batchId: raw.batchId,
        readingDaysPerWeek:
          typeof readingDaysPerWeek === 'string' &&
          readingDaysPerWeek.length > 0
            ? Number(readingDaysPerWeek)
            : undefined,
        readingDays: raw.readingDays,
        attendanceDays: raw.attendanceDays,
      },
    };
  }

  await requireBatchAccess(parsed.data.batchId);

  const [updated] = await db
    .update(batches)
    .set({
      readingDaysPerWeek: parsed.data.readingDaysPerWeek,
      updatedAt: new Date(),
    })
    .where(eq(batches.id, parsed.data.batchId))
    .returning({
      id: batches.id,
      readingDaysPerWeek: batches.readingDaysPerWeek,
    });

  revalidatePath(`/admin/b/${parsed.data.batchId}`);
  revalidatePath(`/admin/b/${parsed.data.batchId}/settings`);

  return {
    ok: true,
    data: updated ?? {
      id: parsed.data.batchId,
      readingDaysPerWeek: parsed.data.readingDaysPerWeek,
    },
  };
}

export type VolunteerRequestActionState = {
  ok: boolean;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
  data?: {
    id: string;
    batchId: string;
    decision: 'approved' | 'rejected';
  };
} | null;

export async function updateVolunteerRequestStatusAction(
  _prevState: VolunteerRequestActionState,
  formData: FormData,
): Promise<VolunteerRequestActionState> {
  const batchId = formData.get('batchId');
  const requestId = formData.get('requestId');
  const decision = formData.get('decision');

  if (
    typeof batchId !== 'string' ||
    typeof requestId !== 'string' ||
    (decision !== 'approved' && decision !== 'rejected')
  ) {
    return {
      ok: false,
      errors: {
        formErrors: ['Invalid volunteer request action.'],
        fieldErrors: {},
      },
    };
  }

  await requireBatchAccess(batchId);

  revalidatePath(`/admin/b/${batchId}`);
  revalidatePath(`/admin/b/${batchId}/volunteers`);

  return {
    ok: true,
    data: {
      id: requestId,
      batchId,
      decision,
    },
  };
}
