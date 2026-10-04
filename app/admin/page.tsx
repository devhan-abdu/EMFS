import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthzError, requireAdminAccess } from '@/lib/auth/authorize';
import { resolveAdminLanding } from '@/lib/admin/landing';
import { ADMIN_LAST_WORKSPACE_COOKIE } from '@/lib/admin-workspace';
import { getAdminBatches, getAdminPaceGroups } from '@/lib/services/admin';

export default async function AdminOverview() {
  let currentUser;
  try {
    currentUser = await requireAdminAccess();
  } catch (error) {
    if (error instanceof AuthzError) {
      redirect(
        error.code === 'UNAUTHENTICATED'
          ? `/signin?next=${encodeURIComponent('/admin')}`
          : '/me',
      );
    }
    throw error;
  }

  const [batches, paceGroups] = await Promise.all([
    getAdminBatches(currentUser),
    getAdminPaceGroups(currentUser),
  ]);
  const savedCookie = (await cookies()).get(ADMIN_LAST_WORKSPACE_COOKIE)?.value;
  redirect(resolveAdminLanding(currentUser, batches, paceGroups, savedCookie));
}
