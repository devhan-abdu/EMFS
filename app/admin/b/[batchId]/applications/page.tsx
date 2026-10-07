import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AuthzError, requireBatchAccess } from '@/lib/auth/authorize';
import { getAdminApplicationsWithHandoff } from '@/lib/services/admin/application-handoff';
import { ApplicationManagementView } from '@/components/admin/application-management-view';

type Props = {
  params: Promise<{ batchId: string }>;
};

export default async function BatchApplicationsPage({ params }: Props) {
  const { batchId } = await params;
  let currentUser;
  try {
    currentUser = await requireBatchAccess(batchId);
  } catch (error) {
    if (error instanceof AuthzError) redirect('/admin');
    throw error;
  }

  const applications = await getAdminApplicationsWithHandoff(
    batchId,
    currentUser,
  );

  return (
    <ApplicationManagementView
      applications={applications}
      title="Batch applications"
      description="Review this batch's applicants and track their Telegram handoff progress."
    />
  );
}

export const metadata: Metadata = {
  title: 'Batch applications — EMFSC Book Shelf Admin',
};
