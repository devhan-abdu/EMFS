import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { SuperAdminToggle } from '@/components/admin/super-admin-toggle';
import { getAdminStaff } from '@/lib/services/admin/services';
import type { Metadata } from 'next';
import { AuthzError, requireSuperAdmin } from '@/lib/auth/authorize';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Roles & access — EMFSC Book Shelf Admin',
  description:
    'Assign super admin, batch admin and pace group admin roles, and see exactly what each level can do.',
  openGraph: {
    title: 'Roles & access — EMFSC Book Shelf Admin',
    description: 'Who can do what across batches, pace groups and the catalog.',
  },
};

export default async function RolesPage() {
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof AuthzError) {
      redirect('/admin');
    }
    throw e;
  }

  const staff = await getAdminStaff();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform access"
        title="Grant assignments"
        description="Global access is independent from batch and pace-group assignments."
      />

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <KeyRound className="size-5" /> Global super admins
        </h2>
        {staff.map((person) => (
          <Card key={person.id} className="card-soft">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-foreground">{person.name}</p>
                <p className="text-sm text-muted-foreground">{person.email}</p>
              </div>
              <SuperAdminToggle
                profileId={person.id}
                name={person.name}
                isSuperAdmin={person.isSuperAdmin}
              />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Batch assignments
        </h2>
        {staff.map((person) => (
          <Card key={person.id} className="card-soft">
            <CardContent className="space-y-2 p-4">
              <p className="font-medium text-foreground">{person.name}</p>
              {person.batchAssignments.length ? (
                person.batchAssignments.map((batch) => (
                  <p key={batch.id} className="text-sm">
                    <Link
                      className="text-primary underline-offset-4 hover:underline"
                      href={`/admin/platform/batches/${batch.id}/edit`}
                    >
                      {batch.name}
                    </Link>
                    <span className="text-muted-foreground"> · </span>
                    <Link
                      className="text-muted-foreground underline-offset-4 hover:underline"
                      href={`/admin/b/${batch.id}`}
                    >
                      Open workspace
                    </Link>
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No batch grants</p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Pace-group assignments
        </h2>
        {staff.map((person) => (
          <Card key={person.id} className="card-soft">
            <CardContent className="space-y-2 p-4">
              <p className="font-medium text-foreground">{person.name}</p>
              {person.paceGroupAssignments.length ? (
                person.paceGroupAssignments.map((group) => (
                  <p key={`${group.id}-${group.batchId}`} className="text-sm">
                    <Link
                      className="text-primary underline-offset-4 hover:underline"
                      href={`/admin/g/${group.id}`}
                    >
                      {group.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {' '}
                      · {group.batchName}
                    </span>
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pace-group grants
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
