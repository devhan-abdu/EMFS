import AddBookForm from "@/components/admin/add-book-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Add Program Book | EMFS",
  description: "Add a program book to the EMFS catalog.",
};

export default function NewBookPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link
          href="/catalog"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Administration
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Add Program Book
          </h1>
        </div>
      </div>

      {/* Info Callout */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/10 bg-primary/5 p-4">
        <span className="material-symbols-outlined text-primary shrink-0 mt-0.5 text-xl">
          info
        </span>
        <p className="text-sm text-muted-foreground">
          This book will be automatically assigned to the next available slot in
          the reading sequence.
        </p>
      </div>

      <AddBookForm />
    </div>
  );
}
