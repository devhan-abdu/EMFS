import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth/authorize';
import { getAdminApplicationsWithHandoff } from '@/lib/services/application/admin-handoff';
import { ApplicationManagementView } from '@/components/admin/application-management-view';

export default async function PlatformApplicationsPage() {
  const currentUser = await requireSuperAdmin();
  const applications = await getAdminApplicationsWithHandoff(
    undefined,
    currentUser,
  );

  return (
    <ApplicationManagementView
      applications={applications}
      title="All applications"
      description="Track applicants and Telegram handoff progress across all batches."
    />
  );
}

export const metadata: Metadata = {
  title: 'All applications — EMFSC Book Shelf Admin',
  description:
    'Track applicants and Telegram handoff progress across all reading batches.',
};
