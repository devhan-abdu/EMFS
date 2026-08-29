import { CreateBatchForm } from "@/components/admin/create-batch-form";

export const metadata = {
  title: "Create Batch | Admin",
  description: "Create a new batch cohort with reading cadence and capacity settings",
};

export default function NewBatchPage() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <CreateBatchForm />
    </div>
  );
}
