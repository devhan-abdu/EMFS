"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 10;

export default function CatalogPagination({
  currentPage,
  totalPages,
  baseUrl,
  pageSize = DEFAULT_PAGE_SIZE,
}: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(pageSize));
    }
    return `${baseUrl}?${params.toString()}`;
  };

  const getPageItems = () => {
    const items: number[] = [];
    const maxVisible = 5;
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + maxVisible - 1);
    const adjustedStart =
      end - start < maxVisible - 1 ? Math.max(1, end - maxVisible + 1) : start;
    for (let i = adjustedStart; i <= end; i++) items.push(i);
    return items;
  };

  const pageItems = getPageItems();
  const atFirst = currentPage <= 1;
  const atLast = currentPage >= totalPages;

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={atFirst ? undefined : createPageUrl(currentPage - 1)}
            aria-disabled={atFirst}
            tabIndex={atFirst ? -1 : undefined}
            className={atFirst ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {pageItems[0]! > 1 && (
          <>
            <PaginationItem>
              <PaginationLink href={createPageUrl(1)}>1</PaginationLink>
            </PaginationItem>
            {pageItems[0]! > 2 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
          </>
        )}
        {pageItems.map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              href={createPageUrl(page)}
              isActive={page === currentPage}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        {pageItems[pageItems.length - 1]! < totalPages && (
          <>
            {pageItems[pageItems.length - 1]! < totalPages - 1 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationLink href={createPageUrl(totalPages)}>
                {totalPages}
              </PaginationLink>
            </PaginationItem>
          </>
        )}
        <PaginationItem>
          <PaginationNext
            href={atLast ? undefined : createPageUrl(currentPage + 1)}
            aria-disabled={atLast}
            tabIndex={atLast ? -1 : undefined}
            className={atLast ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
