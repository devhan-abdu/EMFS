import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Props = {
  page: number;
  totalPages: number;
  /** Base URL path, e.g. "/admin/batches". Page number is appended as ?page=N. */
  basePath?: string;
};

/** Max consecutive page links shown on each side of the current page. */
const SIBLING_COUNT = 1;

function buildPageRanges(
  page: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(2, page - SIBLING_COUNT);
  const right = Math.min(total - 1, page + SIBLING_COUNT);

  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < total - 1;

  const pages: (number | "ellipsis")[] = [1];
  if (showLeftEllipsis) pages.push("ellipsis");
  for (let i = left; i <= right; i++) pages.push(i);
  if (showRightEllipsis) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function BatchPagination({ page, totalPages, basePath = "/admin/batches" }: Props) {
  if (totalPages <= 1) return null;

  const href = (p: number) => `${basePath}?page=${p}`;
  const ranges = buildPageRanges(page, totalPages);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={href(page - 1)}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {ranges.map((entry, idx) =>
          entry === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${idx}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink href={href(entry)} isActive={entry === page}>
                {entry}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href={href(page + 1)}
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
            className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
