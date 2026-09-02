import { getCatalogAction } from "@/actions/catalog";
import CatalogList from "@/components/catalog/catalog-list";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      {/* Header with stats and buttons */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="font-label-md text-label-md text-tertiary-fixed-dim uppercase tracking-[0.1em] mb-2">
            Administration
          </p>
          <h2 className="font-display-lg text-display-lg text-primary tracking-tight">
            Catalog
            <br />
            <span className="text-on-surface-variant">Management</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/admin/catalog/add-edition"
            className="h-11 px-6 flex items-center gap-2 rounded-lg bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              translate
            </span>
            Add Language Edition
          </Link>
          <Link
            href="/admin/catalog/new"
            className="h-11 px-6 flex items-center gap-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              add_circle
            </span>
            Add Program Book
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden group hover:border-secondary-fixed-dim transition-colors">
          <div className="absolute right-0 top-0 w-32 h-32 bg-primary-fixed/20 rounded-bl-full -z-10 transition-transform group-hover:scale-110 duration-500" />
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
            Total Slots
          </p>
          <p className="font-headline-lg text-headline-lg text-primary">
            {totalSlots}
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-secondary">
              trending_up
            </span>
            +12 this month
          </p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden group hover:border-tertiary-fixed-dim transition-colors">
          <div className="absolute right-0 top-0 w-32 h-32 bg-tertiary-fixed/20 rounded-bl-full -z-10 transition-transform group-hover:scale-110 duration-500" />
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
            Active Editions
          </p>
          <p className="font-headline-lg text-headline-lg text-primary">
            {totalBooks}
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 text-sm flex items-center gap-1">
            Across 6 languages
          </p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden group hover:border-primary-fixed-dim transition-colors">
          <div className="absolute right-0 top-0 w-32 h-32 bg-secondary-fixed/20 rounded-bl-full -z-10 transition-transform group-hover:scale-110 duration-500" />
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
            Completion Rate
          </p>
          <p className="font-headline-lg text-headline-lg text-primary">87%</p>
          <div className="w-full bg-surface-variant h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-secondary-fixed h-full w-[87%] rounded-full" />
          </div>
        </div>
      </div>

      {/* Catalog List with Suspense */}
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogList initialData={result} page={currentPage} />
      </Suspense>
    </div>
  );
}
