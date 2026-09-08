import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-layout";
import {
  NewCatalogEntryForms,
  type CatalogBookOption,
} from "@/components/admin/catalog/new-catalog-entry-forms";
import { getCatalog } from "@/lib/services/catalog/get-catalog";

export const metadata: Metadata = {
  title: "Add to the catalog — EMFSC Book Shelf Admin",
  description:
    "Add a program book to the EMFSC reading sequence, or attach a new language edition to an existing book.",
  openGraph: {
    title: "Add to the catalog — EMFSC Book Shelf Admin",
    description: "Add a program book or a new language edition.",
  },
};

export default async function NewCatalogEntryPage() {
  const result = await getCatalog({ page: 1, limit: 100 });
  if (!result.ok) {
    throw new Error("Failed to load catalog");
  }

  const { slots } = result.data;

  const books: CatalogBookOption[] = slots.map((slot) => {
    const preferred =
      slot.editions.find((edition) => edition.language === "en") ??
      slot.editions[0]!;
    return {
      id: preferred.id,
      title: preferred.title,
      author: preferred.author,
      language: preferred.language,
      sequenceOrder: preferred.sequenceOrder,
    };
  });

  return (
    <div className="space-y-8">
      <Link
        href="/admin/catalog"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to catalog
      </Link>

      <PageHeader
        eyebrow="Curriculum"
        title="Add to the catalog"
        description="Program books define the shared reading order. Editions let each sister read in the language she is most at home in."
      />

      <NewCatalogEntryForms books={books} />
    </div>
  );
}
