import { getCatalogAction } from "@/actions/catalog";
import CatalogList from "@/components/catalog/catalog-list";
import { Suspense } from "react";
import Link from "next/link";
import CatalogSkeleton from "./loading";

interface CatalogPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { page } = await searchParams;
  const currentPage = page ? parseInt(page, 10) : 1;
  const limit = 10;

  const result = await getCatalogAction({ page: currentPage, limit });
  const totalSlots = result.ok ? result.data.pagination.totalSlots : 0;
  const totalBooks = result.ok ? result.data.pagination.totalBooks : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Catalog Management
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage the shared reading order and curriculum pipeline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/catalog/add-edition"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface-2 px-5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">
              translate
            </span>
            Add Language Edition
          </Link>
          <Link
            href="/catalog/new"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[18px]">
              add_circle
            </span>
            Add Program Book
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-2 p-6 shadow-sm transition-colors hover:border-secondary/40">
          <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-bl-full bg-primary/10 transition-transform duration-500 group-hover:scale-110" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Slots
          </p>
          <p className="text-3xl font-bold text-primary">{totalSlots}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="material-symbols-outlined text-[16px] text-secondary">
              trending_up
            </span>
            Catalog sequence
          </p>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-2 p-6 shadow-sm transition-colors hover:border-secondary/40">
          <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-bl-full bg-secondary/10 transition-transform duration-500 group-hover:scale-110" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Editions
          </p>
          <p className="text-3xl font-bold text-primary">{totalBooks}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            From seeded catalog data
          </p>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-2 p-6 shadow-sm transition-colors hover:border-secondary/40">
          <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-bl-full bg-accent/10 transition-transform duration-500 group-hover:scale-110" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Completion Rate
          </p>
          <p className="text-3xl font-bold text-primary">N/A</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div className="h-full w-1/3 rounded-full bg-secondary" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Not provided by catalog data
          </p>
        </div>
      </div>

      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogList initialData={result} page={currentPage} />
      </Suspense>
    </div>
  );
}
