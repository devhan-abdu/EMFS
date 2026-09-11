import { Check, Minus, ShieldCheck, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleSelector } from "@/components/admin/role-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  roleBlurbs,
  roleLabels,
  rolePermissions,
  type AdminRole,
} from "@/lib/services/constants/admin-constants";
import { getAdminStaff } from "@/lib/services/admin";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roles & access — EMFSC Book Shelf Admin",
  description:
    "Assign super admin, batch admin and pace group admin roles, and see exactly what each level can do.",
  openGraph: {
    title: "Roles & access — EMFSC Book Shelf Admin",
    description: "Who can do what across batches, pace groups and the catalog.",
  },
};

const roleOrder: AdminRole[] = [
  "super_admin",
  "batch_admin",
  "pace_admin",
  "member",
];

function roleClass(role: AdminRole): string {
  const roles: Record<AdminRole, string> = {
    super_admin: "bg-gold/20 text-gold-foreground border-gold/30",
    batch_admin: "bg-primary/10 text-primary border-primary/20",
    pace_admin: "bg-teal/15 text-teal-foreground border-teal/30",
    member: "bg-muted text-muted-foreground border-border",
  };
  return roles[role];
}

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleClass(role)}`}
    >
      {roleLabels[role]}
    </span>
  );
}

export default async function RolesPage() {
  const staff = await getAdminStaff();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Trust & access"
        title="Roles & access"
        description="Four levels, from super admin down to member. Give each sister the smallest role that lets her do her work."
        actions={
          <Button disabled>
            <UserPlus className="size-4" />
            Invite admin
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {roleOrder.map((role) => (
          <Card key={role} className="card-soft">
            <CardHeader className="space-y-2 pb-3">
              <ShieldCheck className="size-5 text-teal" />
              <CardTitle className="font-display text-lg">
                {roleLabels[role]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {roleBlurbs[role]}
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {staff.filter((s) => s.role === role).length} assigned
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          People with access
        </h2>

        <Card className="card-soft hidden overflow-hidden p-0 md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
                <TableHead className="py-4 pl-6">Person</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="pr-6 text-right">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((person) => (
                <TableRow key={person.id} className="hover:bg-accent/40">
                  <TableCell className="py-4 pl-6">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                        {person.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">
                          {person.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {person.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {person.scope}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {person.lastActive}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <RoleSelector
                      profileId={person.id}
                      name={person.name}
                      role={person.role}
                      roleOrder={roleOrder}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-4 md:hidden">
          {staff.map((person) => (
            <Card key={person.id} className="card-soft">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{person.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {person.email}
                    </p>
                  </div>
                  <RoleBadge role={person.role} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {person.scope} · active {person.lastActive.toLowerCase()}
                </p>
                <RoleSelector
                  profileId={person.id}
                  name={person.name}
                  role={person.role}
                  roleOrder={roleOrder}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          What each level can do
        </h2>
        <Card className="card-soft overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
                <TableHead className="py-4 pl-6">Area</TableHead>
                {roleOrder.map((role) => (
                  <TableHead key={role} className="text-center">
                    {roleLabels[role]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rolePermissions.map((row) => (
                <TableRow key={row.area} className="hover:bg-accent/40">
                  <TableCell className="py-3 pl-6 font-medium text-foreground">
                    {row.area}
                  </TableCell>
                  {roleOrder.map((role) => (
                    <TableCell key={role} className="text-center">
                      {row.access[role] ?
                        <Check
                          className="mx-auto size-4 text-teal"
                          aria-label="Allowed"
                        />
                      : <Minus
                          className="mx-auto size-4 text-muted-foreground/50"
                          aria-label="Not allowed"
                        />
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
