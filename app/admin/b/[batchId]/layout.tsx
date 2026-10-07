import { AdminWorkspaceLayout } from '@/components/admin/admin-workspace-layout';

export default async function BatchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  return (
    <AdminWorkspaceLayout scope={{ kind: 'batch', id: batchId }}>
      {children}
    </AdminWorkspaceLayout>
  );
}
