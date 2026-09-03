import AddEditionForm from "@/components/admin/add-edition-form";
import { getCatalogAction } from "@/actions/catalog";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function AddEditionPage() {
  const result = await getCatalogAction({ page: 1, limit: 100 });
  const books = result.ok ? result.data?.books || [] : [];

  const slotBooks = Array.from(
    new Map(books.map((book) => [book.sequenceOrder, book])).values(),
  );
  const bookOptions = slotBooks.map((book) => ({
    id: book.id,
    label: `Slot ${book.sequenceOrder || "?"}: ${book.title}${book.author ? ` (${book.author})` : ""}`,
  }));

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Add Language Edition
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Create a new language edition for an existing curriculum book.
          </p>
        </div>
      </div>

      <AddEditionForm books={bookOptions} />
    </div>
  );
}