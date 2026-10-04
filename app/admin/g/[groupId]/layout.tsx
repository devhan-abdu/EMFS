import { AdminWorkspaceLayout } from '@/components/admin/admin-workspace-layout';

export default async function PaceGroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <AdminWorkspaceLayout scope={{ kind: 'group', id: groupId }}>
      {children}
    </AdminWorkspaceLayout>
  );
}
