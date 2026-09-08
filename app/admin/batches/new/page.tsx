import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-layout";
import { CreateBatchForm } from "@/components/admin/create-batch-form";
import { getEligibleBatchAdmins } from "@/lib/services/batch";

export const metadata: Metadata = {
  title: "Create a batch — EMFSC Book Shelf Admin",
  description:
    "Create a registration-ready batch with capacity, pacing, and batch admins.",
  openGraph: {
    title: "Create a batch — EMFSC Book Shelf Admin",
    description:
      "Create a registration-ready batch with capacity, pacing, and batch admins.",
  },
};

export default async function NewBatchPage() {
    const admins = await getEligibleBatchAdmins();
  return (
    <div className="space-y-8">
      <Link
        href="/admin/batches"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to batches
      </Link>
      <PageHeader
        eyebrow="New cohort"
        title="Create a batch"
        description="Open registration once the batch settings and batch admins are ready. Pace groups and pace admins can be added later."
      />
       <CreateBatchForm admins={admins} />;
    </div>
  );
}
