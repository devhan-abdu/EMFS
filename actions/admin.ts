'use server';

import { revalidatePath } from 'next/cache';
import { count, eq } from 'drizzle-orm';

import { db } from '@/db';
import { profiles } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/auth/authorize';

export type SuperAdminAccessActionState =
  { ok: true } | { ok: false; error: string } | null;

export async function updateSuperAdminAccessAction(
  _previousState: SuperAdminAccessActionState,
  formData: FormData,
): Promise<SuperAdminAccessActionState> {
  const actor = await requireSuperAdmin();
  const profileId = formData.get('profileId');
  const enabledValue = formData.get('isSuperAdmin');

  if (
    typeof profileId !== 'string' ||
    (enabledValue !== 'true' && enabledValue !== 'false')
  ) {
    return { ok: false, error: 'Invalid super-admin access update.' };
  }

  const enabled = enabledValue === 'true';
  if (profileId === actor.profile.id && !enabled) {
    return { ok: false, error: 'You cannot remove your own global access.' };
  }

  const target = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
  });
  if (!target) return { ok: false, error: 'Profile not found.' };

  if (target.isSuperAdmin && !enabled) {
    const [superAdminCount] = await db
      .select({ value: count() })
      .from(profiles)
      .where(eq(profiles.isSuperAdmin, true));
    if (Number(superAdminCount?.value ?? 0) <= 1) {
      return {
        ok: false,
        error: 'At least one global super admin must remain.',
      };
    }
  }

  await db
    .update(profiles)
    .set({ isSuperAdmin: enabled, updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  revalidatePath('/admin/platform/roles');
  revalidatePath('/admin');
  return { ok: true };
}
