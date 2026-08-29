import Link from "next/link";
import { requireRole } from "@/lib/auth/authorize";
import { Button } from "@/components/ui/button";
import {
  getBatchReadinessStatuses,
  getAdminBatchIds,
  type BatchReadinessStatus,
} from "@/lib/services/batch-readiness";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Batches | Admin",
  description: "Manage batches and view setup readiness status",
};

const PAGE_SIZE = 20;

function ReadinessIcon({ ready }: { ready: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center text-sm ${
        ready ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
      }`}
      title={ready ? "Ready" : "Not Ready"}
    >
      {ready ? "✅" : "❌"}
    </span>
  );
}

function ReadinessSummaryBadge({ status }: { status: BatchReadinessStatus }) {
  const checks = [
    status.catalogReady,
    status.batchAdminsAssigned,
    status.paceGroupsReady,
    status.paceAdminsAssigned,
    status.pacingConfirmed,
    status.registrationOpen,
  ];
  const passed = checks.filter(Boolean).length;
  const allReady = passed === checks.length;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        allReady
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
      }`}
    >
      {allReady ? "All Ready" : `${passed}/6`}
    </span>
  );
}

function PaginationControls({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-1">
        {page > 1 && (
          <Link href={`/batches?page=${page - 1}`}>
            <Button variant="outline" size="sm">
              Previous
            </Button>
          </Link>
        )}
        {pages.map((p) => (
          <Link key={p} href={`/batches?page=${p}`}>
            <Button
              variant={p === page ? "default" : "outline"}
              size="sm"
            >
              {p}
            </Button>
          </Link>
        ))}
        {page < totalPages && (
          <Link href={`/batches?page=${page + 1}`}>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // Role-based filtering: super_admin sees all, batch_admin sees only assigned batches
  const currentUser = await requireRole(["pace_admin"]);
  const role = currentUser.profile.role;

  let filterBatchIds: string[] | undefined;
  if (role === "batch_admin") {
    filterBatchIds = await getAdminBatchIds(currentUser.profile.id);
  }
  // super_admin: filterBatchIds remains undefined → sees all
  // pace_admin: also sees all (layout gate already filters unauthorized roles)

  const result = await getBatchReadinessStatuses(page, PAGE_SIZE, filterBatchIds);

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Batches</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            View and manage reading batches and cohort schedules.
          </p>
        </div>
        <Link href="/batches/new">
          <Button>Create Batch</Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-3">Batch Name</th>
                <th className="px-3 py-3 text-center" title="At least 1 catalog book exists">Catalog</th>
                <th className="px-3 py-3 text-center" title="1–3 batch admins assigned">Admins</th>
                <th className="px-3 py-3 text-center" title="Actual pace groups match expected count">Groups</th>
                <th className="px-3 py-3 text-center" title="Every pace group has at least 1 admin">Pace Admins</th>
                <th className="px-3 py-3 text-center" title="Start date and pacing type configured">Pacing</th>
                <th className="px-3 py-3 text-center" title="Registration is open">Registration</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {filterBatchIds !== undefined
                      ? "No batches assigned to you."
                      : 'No batches created yet. Click "Create Batch" to create one.'}
                  </td>
                </tr>
              ) : (
                result.items.map((status) => (
                  <tr key={status.batchId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {status.batchName}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ReadinessIcon ready={status.catalogReady} />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ReadinessIcon ready={status.batchAdminsAssigned} />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ReadinessIcon ready={status.paceGroupsReady} />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ReadinessIcon ready={status.paceAdminsAssigned} />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ReadinessIcon ready={status.pacingConfirmed} />
                    </td>
                    <td className="px-3 py-4 text-center">
                      <ReadinessIcon ready={status.registrationOpen} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <ReadinessSummaryBadge status={status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls page={result.page} totalPages={result.totalPages} />
      </div>

      {result.total > 0 && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Showing {result.items.length} of {result.total} batch{result.total !== 1 ? "es" : ""}
        </p>
      )}
    </div>
  );
}
