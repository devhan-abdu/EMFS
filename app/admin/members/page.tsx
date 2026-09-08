import { Search } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/shared/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminApplications } from "@/lib/services/admin";
import { ApplicationRowActions } from "@/components/admin/application-row-actions";
import { Metadata } from "next";

type ApplicationStatus = "pending" | "approved" | "handoff" | "rejected";

export const metadata: Metadata = {
  title: "Applications — EMFSC Book Shelf Admin",
  description:
    "Review applications, approve members and track the Telegram handoff for each EMFSC reading batch.",
  openGraph: {
    title: "Applications — EMFSC Book Shelf Admin",
    description: "Review applicants and track approvals and handoffs.",
  },
};

const tabs: { value: ApplicationStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "handoff", label: "Handed off" },
  { value: "all", label: "Everyone" },
];

function statusClass(status: ApplicationStatus): string {
  const classes: Record<ApplicationStatus, string> = {
    pending: "bg-gold/20 text-gold-foreground border-gold/30",
    approved: "bg-teal/15 text-teal-foreground border-teal/30",
    handoff: "bg-primary/10 text-primary border-primary/20",
    rejected: "bg-muted text-muted-foreground border-border",
  };

  return classes[status];
}

export default async function MembersPage() {
  const applications = await getAdminApplications();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intake"
        title="Applications"
        description="Review each sister's application, approve her into a pace group, then confirm the Telegram handoff."
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email"
              className="w-full pl-9 md:w-72"
            />
          </div>
        }
      />

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-surface-container">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => {
          const rows =
            tab.value === "all" ?
              applications
            : applications.filter((a) => a.status === tab.value);

          return (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="space-y-4"
            >
              {rows.length === 0 ?
                <EmptyState
                  title="Nothing here yet"
                  description="When sisters apply to an open batch, they'll appear here for review."
                />
              : <>
                  <Card className="card-soft hidden overflow-hidden p-0 md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-surface-container/70 hover:bg-surface-container/70">
                          <TableHead className="py-4 pl-6">Applicant</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="pr-6 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((app) => (
                          <TableRow key={app.id} className="hover:bg-accent/40">
                            <TableCell className="py-4 pl-6">
                              <div className="flex items-center gap-3">
                                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                                  {app.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </span>
                                <div>
                                  <p className="font-medium text-foreground">
                                    {app.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {app.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {app.batch}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {app.appliedOn}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusClass(app.status)}`}
                              >
                                {app.status === "handoff" ?
                                  "Handed off"
                                : app.status}
                              </span>
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <ApplicationRowActions
                                status={app.status}
                                name={app.name}
                                profileId={app.profileId}
                                batchId={app.batchId}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>

                  <div className="space-y-4 md:hidden">
                    {rows.map((app) => (
                      <Card key={app.id} className="card-soft">
                        <CardContent className="space-y-3 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {app.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {app.email}
                              </p>
                            </div>
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusClass(app.status)}`}
                            >
                              {app.status === "handoff" ?
                                "Handed off"
                              : app.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {app.batch} · applied {app.appliedOn}
                          </p>
                          <ApplicationRowActions
                            status={app.status}
                            name={app.name}
                            profileId={app.profileId}
                            batchId={app.batchId}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              }
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
