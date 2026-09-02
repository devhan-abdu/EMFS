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
}

export default function CatalogPagination({
  currentPage,
  totalPages,
  baseUrl,
}: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => `${baseUrl}?page=${page}`;

  const getPageItems = () => {
    const items = [];
    const maxVisible = 5;
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + maxVisible - 1);
    const adjustedStart =
      end - start < maxVisible - 1 ? Math.max(1, end - maxVisible + 1) : start;
    for (let i = adjustedStart; i <= end; i++) items.push(i);
    return items;
  };

  const pageItems = getPageItems();

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={currentPage > 1 ? createPageUrl(currentPage - 1) : undefined}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {pageItems[0] > 1 && (
          <>
            <PaginationItem>
              <PaginationLink href={createPageUrl(1)}>1</PaginationLink>
            </PaginationItem>
            {pageItems[0] > 2 && <PaginationEllipsis />}
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
        {pageItems[pageItems.length - 1] < totalPages && (
          <>
            {pageItems[pageItems.length - 1] < totalPages - 1 && (
              <PaginationEllipsis />
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
            href={
              currentPage < totalPages
                ? createPageUrl(currentPage + 1)
                : undefined
            }
            className={
              currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
