import { AdminWorkspaceLayout } from '@/components/admin/admin-workspace-layout';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminWorkspaceLayout scope={{ kind: 'platform' }}>
      {children}
    </AdminWorkspaceLayout>
  );
}
