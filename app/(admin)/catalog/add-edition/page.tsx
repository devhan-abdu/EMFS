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
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          href="/catalog"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="font-label-md text-label-sm text-tertiary-fixed-dim uppercase tracking-[0.1em] mb-1">
            Administration
          </p>
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary">
            Add Language Edition
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Create a new language edition for an existing curriculum book.
          </p>
        </div>
      </div>

      <AddEditionForm books={bookOptions} />
    </div>
  );
}
