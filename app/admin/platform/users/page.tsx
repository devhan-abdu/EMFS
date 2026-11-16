import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { batches, paceGroups } from '@/db/schema';
import { AuthzError, requireSuperAdmin } from '@/lib/auth/authorize';
import {
  getUserDetails,
  listUsers,
} from '@/lib/services/admin/user-management';
import { listUsersSchema } from '@/lib/validations/user-management';
import { UserManagementView } from '@/components/admin/users/user-management-view';

export const metadata: Metadata = {
  title: 'User Management — EMFSC Book Shelf Admin',
  description:
    'Search users, inspect administrative scopes and responsibilities, safely modify roles, and review audit history.',
  openGraph: {
    title: 'User Management — EMFSC Book Shelf Admin',
    description:
      'Search users, inspect administrative scopes, safely modify roles, and review audit history.',
  },
};

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function UserManagementPage({ searchParams }: PageProps) {
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof AuthzError) {
      redirect('/admin');
    }
    throw e;
  }

  const rawParams = await searchParams;

  // Normalize single-string params
  const q = typeof rawParams.q === 'string' ? rawParams.q : undefined;
  const role = typeof rawParams.role === 'string' ? rawParams.role : undefined;
  const batchId =
    typeof rawParams.batchId === 'string' ? rawParams.batchId : undefined;
  const paceGroupId =
    typeof rawParams.paceGroupId === 'string'
      ? rawParams.paceGroupId
      : undefined;
  const telegram =
    typeof rawParams.telegram === 'string' ? rawParams.telegram : undefined;
  const page = typeof rawParams.page === 'string' ? Number(rawParams.page) : 1;
  const pageSize =
    typeof rawParams.pageSize === 'string' ? Number(rawParams.pageSize) : 20;
  const userId =
    typeof rawParams.userId === 'string' ? rawParams.userId : undefined;

  const parsed = listUsersSchema.safeParse({
    page,
    pageSize,
    q,
    role,
    batchId,
    paceGroupId,
    telegram,
  });

  const filterInput = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 20,
        role: 'all' as const,
        telegram: 'all' as const,
      };

  // Fetch users, scope options, and optionally initial user detail
  const [userListResult, batchOptions, paceGroupOptions, initialUserDetails] =
    await Promise.all([
      listUsers(filterInput),
      db
        .select({ id: batches.id, name: batches.name })
        .from(batches)
        .orderBy(asc(batches.name)),
      db
        .select({
          id: paceGroups.id,
          name: paceGroups.name,
          batchId: batches.id,
          batchName: batches.name,
        })
        .from(paceGroups)
        .innerJoin(batches, eq(paceGroups.batchId, batches.id))
        .where(eq(paceGroups.archived, false))
        .orderBy(asc(batches.name), asc(paceGroups.name)),
      userId ? getUserDetails(userId) : Promise.resolve(null),
    ]);

  return (
    <UserManagementView
      initialData={userListResult}
      scopeOptions={{
        batches: batchOptions,
        paceGroups: paceGroupOptions,
      }}
      initialUserDetails={initialUserDetails}
    />
  );
}
