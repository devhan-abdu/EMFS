'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { batches } from '@/db/schema';
import {
  AuthzError,
  requireBatchAccess,
  requirePaceGroupAccess,
} from '@/lib/auth/authorize';
import {
  BATCH_WEEKDAYS,
  updateBatchCadenceSchema,
  updateScheduleSettingsSchema,
  resetPaceGroupScheduleSchema,
  createBatchBreakSchema,
  deleteBatchBreakSchema,
} from '@/lib/validations/batch-settings';
import {
  createBatchBreak,
  deleteBatchBreak,
  getBatchBreakById,
} from '@/lib/services/batches/breaks';
import {
  deletePaceGroupOverride,
  setPaceGroupOverride,
} from '@/lib/services/batches/batch-schedule-overrides';

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

/* -------------------------------------------------------------------------- */
/* EMF-88 Schedule Settings & Overrides                                       */
/* -------------------------------------------------------------------------- */

export type ScheduleSettingsActionState = {
  ok: boolean;
  message?: string;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
  data?: {
    scope: 'batch' | 'group';
    batchId: string;
    paceGroupId?: string | null;
    readingDaysPerWeek: number;
    readingDays: string[];
    attendanceDay?: string | null;
    attendanceTime?: string | null;
  };
} | null;

export async function saveScheduleSettingsAction(
  _prevState: ScheduleSettingsActionState,
  formData: FormData,
): Promise<ScheduleSettingsActionState> {
  const batchIdRaw = formData.get('batchId');
  const paceGroupIdRaw = formData.get('paceGroupId');
  const batchId = typeof batchIdRaw === 'string' ? batchIdRaw : '';
  const paceGroupId =
    typeof paceGroupIdRaw === 'string' &&
    paceGroupIdRaw.trim() !== '' &&
    paceGroupIdRaw !== 'all'
      ? paceGroupIdRaw.trim()
      : null;

  // 1. Authorization guard as first line
  try {
    if (paceGroupId) {
      await requirePaceGroupAccess(paceGroupId);
    } else {
      if (!batchId) {
        return {
          ok: false,
          errors: { formErrors: ['Missing batch ID.'], fieldErrors: {} },
        };
      }
      await requireBatchAccess(batchId);
    }
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false,
        errors: { formErrors: [error.message], fieldErrors: {} },
      };
    }
    throw error;
  }

  // 2. Input validation
  const readingDays = normalizeWeekdays(formData.getAll('readingDays'));
  const readingDaysPerWeekRaw = formData.get('readingDaysPerWeek');
  const attendanceDay = formData.get('attendanceDay');
  const attendanceTime = formData.get('attendanceTime');

  const rawInput = {
    batchId,
    paceGroupId,
    readingDays,
    readingDaysPerWeek:
      readingDaysPerWeekRaw !== null && readingDaysPerWeekRaw !== ''
        ? Number(readingDaysPerWeekRaw)
        : undefined,
    attendanceDay:
      typeof attendanceDay === 'string' && attendanceDay !== ''
        ? attendanceDay
        : null,
    attendanceTime:
      typeof attendanceTime === 'string' && attendanceTime !== ''
        ? attendanceTime
        : null,
  };

  const parsed = updateScheduleSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  const {
    batchId: validBatchId,
    paceGroupId: validGroupId,
    readingDays: validReadingDays,
    readingDaysPerWeek,
    attendanceDay: validAttendanceDay,
    attendanceTime: validAttendanceTime,
  } = parsed.data;

  // 3. Execution
  if (validGroupId) {
    // Specific pace group override
    setPaceGroupOverride({
      batchId: validBatchId,
      paceGroupId: validGroupId,
      readingDays: validReadingDays,
      readingDaysPerWeek,
      attendanceDay: validAttendanceDay,
      attendanceTime: validAttendanceTime,
    });

    revalidatePath(`/admin/b/${validBatchId}`);
    revalidatePath(`/admin/b/${validBatchId}/settings`);
    revalidatePath(`/admin/g/${validGroupId}`);
    revalidatePath(`/admin/g/${validGroupId}/settings`);

    return {
      ok: true,
      message: 'Custom settings saved for this pace group.',
      data: {
        scope: 'group',
        batchId: validBatchId,
        paceGroupId: validGroupId,
        readingDaysPerWeek,
        readingDays: validReadingDays,
        attendanceDay: validAttendanceDay,
        attendanceTime: validAttendanceTime,
      },
    };
  }

  // Batch default
  await db
    .update(batches)
    .set({
      readingDaysPerWeek,
      updatedAt: new Date(),
    })
    .where(eq(batches.id, validBatchId));

  revalidatePath(`/admin/b/${validBatchId}`);
  revalidatePath(`/admin/b/${validBatchId}/settings`);

  return {
    ok: true,
    message: 'Batch default schedule settings updated.',
    data: {
      scope: 'batch',
      batchId: validBatchId,
      paceGroupId: null,
      readingDaysPerWeek,
      readingDays: validReadingDays,
      attendanceDay: validAttendanceDay,
      attendanceTime: validAttendanceTime,
    },
  };
}

export type ResetOverrideActionState = {
  ok: boolean;
  message?: string;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
} | null;

export async function resetPaceGroupScheduleAction(
  _prevState: ResetOverrideActionState,
  formData: FormData,
): Promise<ResetOverrideActionState> {
  const batchId = formData.get('batchId');
  const paceGroupId = formData.get('paceGroupId');

  if (typeof paceGroupId !== 'string' || !paceGroupId) {
    return {
      ok: false,
      errors: {
        formErrors: ['Pace group ID is required to reset overrides.'],
        fieldErrors: {},
      },
    };
  }

  // 1. Authorization guard first
  try {
    await requirePaceGroupAccess(paceGroupId);
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false,
        errors: { formErrors: [error.message], fieldErrors: {} },
      };
    }
    throw error;
  }

  // 2. Validation
  const parsed = resetPaceGroupScheduleSchema.safeParse({
    batchId: typeof batchId === 'string' ? batchId : undefined,
    paceGroupId,
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  // 3. Execution
  deletePaceGroupOverride(parsed.data.paceGroupId);

  revalidatePath(`/admin/b/${parsed.data.batchId}`);
  revalidatePath(`/admin/b/${parsed.data.batchId}/settings`);
  revalidatePath(`/admin/g/${parsed.data.paceGroupId}`);
  revalidatePath(`/admin/g/${parsed.data.paceGroupId}/settings`);

  return {
    ok: true,
    message: 'Reset to batch default successfully.',
  };
}

/* -------------------------------------------------------------------------- */
/* EMF-88 Breaks Management Actions                                           */
/* -------------------------------------------------------------------------- */

export type BreakActionState = {
  ok: boolean;
  message?: string;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
  };
  data?: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    paceGroupId: string | null;
  };
} | null;

export async function createBatchBreakAction(
  _prevState: BreakActionState,
  formData: FormData,
): Promise<BreakActionState> {
  const batchIdRaw = formData.get('batchId');
  const paceGroupIdRaw = formData.get('paceGroupId');
  const title = formData.get('title');
  const startDate = formData.get('startDate');
  const endDate = formData.get('endDate');

  const batchId = typeof batchIdRaw === 'string' ? batchIdRaw : '';
  const paceGroupId =
    typeof paceGroupIdRaw === 'string' &&
    paceGroupIdRaw.trim() !== '' &&
    paceGroupIdRaw !== 'all'
      ? paceGroupIdRaw.trim()
      : null;

  // 1. Server-side authorization check FIRST
  let currentUser;
  try {
    if (paceGroupId) {
      // Group break: Super Admin, Batch Admin, or Pace Admin of this group
      currentUser = await requirePaceGroupAccess(paceGroupId);
    } else {
      // Whole batch break: Super Admin or Batch Admin of this batch ONLY
      if (!batchId) {
        return {
          ok: false,
          errors: { formErrors: ['Missing batch ID.'], fieldErrors: {} },
        };
      }
      currentUser = await requireBatchAccess(batchId);
    }
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false,
        errors: { formErrors: [error.message], fieldErrors: {} },
      };
    }
    throw error;
  }

  // 2. Input validation
  const parsed = createBatchBreakSchema.safeParse({
    batchId,
    paceGroupId,
    title: typeof title === 'string' ? title : '',
    startDate: typeof startDate === 'string' ? startDate : '',
    endDate: typeof endDate === 'string' ? endDate : '',
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  // 3. Execution
  const created = await createBatchBreak(parsed.data, currentUser.profile.id);

  revalidatePath(`/admin/b/${parsed.data.batchId}`);
  revalidatePath(`/admin/b/${parsed.data.batchId}/settings`);
  if (parsed.data.paceGroupId) {
    revalidatePath(`/admin/g/${parsed.data.paceGroupId}`);
    revalidatePath(`/admin/g/${parsed.data.paceGroupId}/settings`);
  }

  return {
    ok: true,
    message: 'Break added successfully.',
    data: {
      id: created.id,
      title: created.title,
      startDate: created.startDate,
      endDate: created.endDate,
      paceGroupId: created.paceGroupId,
    },
  };
}

export async function deleteBatchBreakAction(
  _prevState: BreakActionState,
  formData: FormData,
): Promise<BreakActionState> {
  const breakId = formData.get('breakId');
  const batchId = formData.get('batchId');

  const parsed = deleteBatchBreakSchema.safeParse({
    breakId: typeof breakId === 'string' ? breakId : undefined,
    batchId: typeof batchId === 'string' ? batchId : undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  // 1. Find the target break to determine scope
  const targetBreak = await getBatchBreakById(parsed.data.breakId);
  if (!targetBreak || targetBreak.batchId !== parsed.data.batchId) {
    return {
      ok: false,
      errors: {
        formErrors: ['Break not found or does not belong to this batch.'],
        fieldErrors: {},
      },
    };
  }

  // 2. Authorization guard:
  // If whole-batch break -> requireBatchAccess (rejects Pace Admins)
  // If group break -> requirePaceGroupAccess (allows assigned Pace Admin or Batch Admin)
  try {
    if (targetBreak.paceGroupId) {
      await requirePaceGroupAccess(targetBreak.paceGroupId);
    } else {
      await requireBatchAccess(targetBreak.batchId);
    }
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false,
        errors: { formErrors: [error.message], fieldErrors: {} },
      };
    }
    throw error;
  }

  // 3. Execution
  await deleteBatchBreak(targetBreak.id, targetBreak.batchId);

  revalidatePath(`/admin/b/${targetBreak.batchId}`);
  revalidatePath(`/admin/b/${targetBreak.batchId}/settings`);
  if (targetBreak.paceGroupId) {
    revalidatePath(`/admin/g/${targetBreak.paceGroupId}`);
    revalidatePath(`/admin/g/${targetBreak.paceGroupId}/settings`);
  }

  return {
    ok: true,
    message: 'Break removed successfully.',
  };
}
