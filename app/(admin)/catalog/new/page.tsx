import AddBookForm from "@/components/admin/add-book-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Add Program Book | EMFS",
  description: "Add a program book to the EMFS catalog.",
};

export default function NewBookPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/catalog"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-2 text-foreground transition-colors hover:bg-surface-container"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Administration
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Add Program Book
          </h1>
        </div>
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
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