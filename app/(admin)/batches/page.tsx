import Link from "next/link";
import { db } from "@/db";
import { batches } from "@/db/schema";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Batches | Admin",
  description: "Manage batches and create new reading cohorts",
};

export default async function BatchesPage() {
  const allBatches = await db.select().from(batches);

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
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
            <tr>
              <th className="px-6 py-3">Batch Name</th>
              <th className="px-6 py-3">Max Members</th>
              <th className="px-6 py-3">Pace Groups</th>
              <th className="px-6 py-3">Start Date</th>
              <th className="px-6 py-3">Reading Days / Wk</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {allBatches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No batches created yet. Click &quot;Create Batch&quot; to create one.
                </td>
              </tr>
            ) : (
              allBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {batch.name}
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    {batch.maxMembers}
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    {batch.paceGroupCount}
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    {batch.startDate ? String(batch.startDate) : "Not set"}
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    {batch.readingDaysPerWeek} days
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        batch.registrationOpen
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      {batch.registrationOpen ? "Open" : "Not Yet Open"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
