import Link from "next/link";
import type { Metadata } from "next";

import { Languages, Plus } from "lucide-react";

import { CatalogSortableList } from "@/components/admin/catalog/catalog-sortable-list";
import CatalogPagination from "@/components/catalog/catalog-pagination";
import { PageHeader, StatCard } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCatalog } from "@/lib/services/catalog/get-catalog";
import { getCatalogSchema } from "@/lib/validations/catalog";

export const metadata: Metadata = {
  title: "Book catalog — EMFSC Book Shelf Admin",
  description:
    "Curate the shared EMFSC reading order: program books, language editions, pairings and reading tasks.",
  openGraph: {
    title: "Book catalog — EMFSC Book Shelf Admin",
    description: "Curate the shared reading order and language editions.",
  },
};

type CatalogPageProps = {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
  }>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const parsed = getCatalogSchema.safeParse({
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 10,
  });
  const { page, pageSize } = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 10 };

  const result = await getCatalog({ page, pageSize });
  if (!result.ok) {
    throw new Error("Failed to load catalog");
  }

  const { slots, pagination } = result.data;
  const pageTasks = slots.reduce(
    (count, slot) =>
      count +
      slot.editions.reduce(
        (slotCount, edition) => slotCount + (edition.tasksCount ?? 0),
        0,
      ),
    0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Curriculum"
        title="Book catalog"
        description="The shared reading order every batch follows. Slot order decides what each pace group reads next."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/catalog/new?mode=edition">
                <Languages className="size-4" />
                Add edition
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/catalog/new?mode=book">
                <Plus className="size-4" />
                Add program book
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <StatCard
          label="Catalog slots"
          value={pagination.totalSlots}
          hint="In the reading sequence"
        />
        <StatCard
          label="Language editions"
          value={pagination.totalBooks}
          hint="Across all books"
          tone="teal"
        />
        <StatCard
          label="Reading tasks"
          value={pageTasks}
          hint="On this page"
          tone="gold"
        />
      </div>

      <div className="space-y-4">
        {slots.length === 0 ?
          <Card className="card-soft">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {pagination.totalSlots === 0
                  ? "No books in the catalog yet."
                  : "No books on this page."}
              </p>
              {pagination.totalSlots === 0 ?
                <Button asChild>
                  <Link href="/admin/catalog/new?mode=book">
                    <Plus className="size-4" />
                    Add program book
                  </Link>
                </Button>
              : null}
            </CardContent>
          </Card>
        : <CatalogSortableList slots={slots} />
        }
      </div>

      <CatalogPagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        baseUrl="/admin/catalog"
      />
    </div>
  );
}
