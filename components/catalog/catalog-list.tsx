"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Link as LinkIcon } from "lucide-react";
import CatalogPagination from "./catalog-pagination";
import { SlotReorderControls } from "./slot-reorder-controls";
import { reorderCatalogSlotsAction } from "@/actions/catalog";
import type { ActionResult } from "@/lib/validations/catalog";
import type {
  CatalogBookItem,
  PaginatedCatalogResult,
} from "@/lib/services/get-catalog";

interface CatalogListProps {
  initialData: ActionResult<PaginatedCatalogResult>;
  page: number;
}

export default function CatalogList({ initialData, page }: CatalogListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedSlots, setExpandedSlots] = useState<Set<number>>(new Set());

  const handleMoveSlot = (fromSlot: number, toSlot: number) => {
    if (isPending || fromSlot === toSlot) return;

    startTransition(async () => {
      try {
        const res = await reorderCatalogSlotsAction({ fromSlot, toSlot });
        if (res.ok) {
          toast.success(`Slot ${fromSlot} moved to Slot ${toSlot}`);
          router.refresh();
        } else {
          const errorMsg =
            res.errors?.[0]?.message || "Failed to reorder catalog slot.";
          toast.error(errorMsg);
          router.refresh();
        }
      } catch (error) {
        toast.error("An unexpected error occurred while reordering.");
        router.refresh();
      }
    });
  };

  if (!initialData.ok) {
    return (
      <div className="rounded-lg bg-destructive/10 p-6 border border-destructive/20 text-center">
        <h4 className="font-semibold text-destructive mb-2">
          Failed to load catalog
        </h4>

        <p className="text-sm text-destructive/80">
          Please refresh and try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const data = initialData.data;
  const totalSlotsCount = data?.pagination?.totalSlots || data?.slots?.length || 0;


  if (!data || data.slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <div className="w-24 h-24 mb-4 rounded-full bg-surface-container flex items-center justify-center border border-outline-subtle relative">
          <span className="material-symbols-outlined text-4xl text-outline-subtle">
            menu_book
          </span>
        </div>
        <h3 className="font-headline-md text-headline-md text-text-primary mb-2">
          The library is empty
        </h3>
        <p className="font-body-md text-body-md text-text-secondary mb-6 max-w-[280px]">
          Add your first program book or language edition to start building the
          catalog.
        </p>
        <Link href="/admin/catalog/new">
          <Button className="h-11 px-6 bg-primary text-on-primary">
            <span className="material-symbols-outlined text-[20px] mr-2">
              add
            </span>
            Create Item
          </Button>
        </Link>
      </div>
    );
  }

  const toggleSlot = (slot: number) => {
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Table view for md and up */}
      <div className="hidden md:block bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <Table>
          <TableHeader className="bg-surface-container">
            <TableRow>
              <TableHead className="w-[80px] text-center">Slot</TableHead>
              <TableHead className="w-[60px]">Cover</TableHead>
              <TableHead>Book Details</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead className="w-[120px]">Language</TableHead>
              <TableHead className="w-[160px]">Editions</TableHead>
              <TableHead className="w-[100px] text-center">Reorder</TableHead>
              <TableHead className="w-[60px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slots.map((slotGroup) => {
              const slot = slotGroup.slot;
              const books = slotGroup.editions;
              const primaryBook = books[0];
              const hasMultiple = books.length > 1;
              const isExpanded = expandedSlots.has(slot);

              return (
                <>
                  <TableRow
                    key={slot}
                    className={`cursor-pointer hover:bg-surface-container-lowest/50 transition-colors ${hasMultiple ? "bg-surface-container/30" : ""}`}
                    onClick={() => hasMultiple && toggleSlot(slot)}
                  >
                    <TableCell className="text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        {hasMultiple && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSlot(slot);
                            }}
                            className="p-2 rounded hover:bg-surface-variant"
                          >

                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <span className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center font-headline-md text-headline-md text-primary">
                          {slot}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {primaryBook.coverUrl ? (
                        <div className="w-12 h-18 bg-surface-variant rounded shadow-sm overflow-hidden border border-outline-variant/20 relative">
                          <Image
                            src={primaryBook.coverUrl}
                            alt={primaryBook.title}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-18 bg-surface-variant rounded flex items-center justify-center text-outline">
                          <span className="material-symbols-outlined text-2xl">
                            image_not_supported
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col min-w-0 pr-4">
                        <h4 className="font-headline-md text-[18px] leading-tight text-primary truncate">
                          {primaryBook.title}
                        </h4>
                        <p className="font-body-md text-body-md text-on-surface-variant truncate">
                          {primaryBook.author || "Unknown author"}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase tracking-wider"
                          >
                            {primaryBook.pairedBookId
                              ? "Paired Edition"
                              : "Program Book"}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle">Type</TableCell>
                    <TableCell className="align-middle">
                      <span className="font-label-md text-label-md text-on-surface">
                        {primaryBook.language}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {books.slice(0, 3).map((book: CatalogBookItem) => (
                            <div
                              key={book.id}
                              className="w-6 h-6 rounded-full bg-surface-variant border-2 border-surface-container-lowest flex items-center justify-center text-[10px] font-bold text-on-surface-variant"
                              title={book.language}
                            >
                              {book.language.slice(0, 2).toUpperCase()}
                            </div>
                          ))}
                          {books.length > 3 && (
                            <span className="text-[10px] text-secondary ml-2">
                              +{books.length - 3}
                            </span>
                          )}
                        </div>
                        {hasMultiple && (
                          <span className="font-label-sm text-label-sm text-secondary">
                            {books.length} editions
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <SlotReorderControls
                        slot={slot}
                        totalSlots={totalSlotsCount}
                        onMoveUp={(s) => handleMoveSlot(s, s - 1)}
                        onMoveDown={(s) => handleMoveSlot(s, s + 1)}
                        isPending={isPending}
                      />
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <button className="w-8 h-8 rounded-full hover:bg-surface-variant text-on-surface-variant transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">
                          more_vert
                        </span>
                      </button>
                    </TableCell>
                  </TableRow>

                  {hasMultiple &&
                    isExpanded &&
                    books.slice(1).map((book: CatalogBookItem) => (
                      <TableRow
                        key={book.id}
                        className="bg-surface/50 border-t border-surface-variant/50"
                      >
                        <TableCell className="text-center">
                          <div className="w-3 h-3 rounded-full border-2 border-outline-variant/50 bg-surface mx-auto" />
                        </TableCell>
                        <TableCell>
                          {book.coverUrl ? (
                            <div className="w-10 h-15 bg-surface-variant rounded overflow-hidden relative opacity-80">
                              <Image
                                src={book.coverUrl}
                                alt={book.title}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-15 bg-surface-variant rounded flex items-center justify-center text-outline opacity-80">
                              <span className="material-symbols-outlined text-xl">
                                image_not_supported
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col min-w-0 pr-4 opacity-80">
                            <h4 className="font-body-md text-body-md text-on-surface truncate">
                              {book.title}
                            </h4>
                            <p className="font-label-sm text-label-sm text-outline truncate">
                              {book.pairedBookId
                                ? "Paired Edition"
                                : "Standalone"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">Type</TableCell>
                        <TableCell className="align-middle">
                          <span className="font-label-md text-label-md text-on-surface-variant">
                            {book.language}
                          </span>
                        </TableCell>
                        <TableCell className="align-middle">
                          <span className="inline-flex items-center gap-2 font-label-sm text-label-sm text-outline">
                            <LinkIcon className="h-3 w-3" />
                            {book.pairedBookId ? "Linked" : "Unlinked"}
                          </span>
                        </TableCell>

                        <TableCell className="align-middle" />
                        <TableCell className="text-center align-middle">
                          <button className="w-8 h-8 rounded-full hover:bg-surface-variant text-outline transition-colors flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px]">
                              edit
                            </span>
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                </>
              );
            })}
          </TableBody>
        </Table>

        <div className="p-4 border-t border-outline-variant/30">
          <CatalogPagination
            currentPage={page}
            totalPages={data.pagination?.totalPages || 1}
            baseUrl="/admin/catalog"
          />
        </div>
      </div>

      {/* Card view for mobile */}
      <div className="md:hidden flex flex-col gap-4">
        {data.slots.map((slotGroup) => {
          const slot = slotGroup.slot;
          const books = slotGroup.editions;
          const primaryBook = books[0];
          const hasMultiple = books.length > 1;

          return (
            <div
              key={slot}
              className="bg-surface-container rounded-xl border border-outline-subtle overflow-hidden hover:border-outline transition-colors group"
            >
              <div className="p-4 flex gap-4 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
                <div className="w-20 h-28 bg-surface-container-high rounded-md overflow-hidden relative shrink-0">
                  {primaryBook.coverUrl ? (
                    <Image
                      src={primaryBook.coverUrl}
                      alt={primaryBook.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-outline">
                      <span className="material-symbols-outlined text-3xl">
                        image_not_supported
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0 z-10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <h3 className="font-headline-md text-headline-md text-text-primary truncate">
                        {primaryBook.title}
                      </h3>
                      <span className="font-body-md text-body-md text-text-secondary truncate mt-2">
                        Slot: {slot}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <SlotReorderControls
                        slot={slot}
                        totalSlots={totalSlotsCount}
                        onMoveUp={(s) => handleMoveSlot(s, s - 1)}
                        onMoveDown={(s) => handleMoveSlot(s, s + 1)}
                        isPending={isPending}
                      />
                      <button className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container-high hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">
                          more_vert
                        </span>
                      </button>
                    </div>
                  </div>


                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Badge
                      variant="secondary"
                      className="text-[11px] uppercase tracking-wider"
                    >
                      Program Book
                    </Badge>
                    {hasMultiple && (
                      <Badge
                        variant="outline"
                        className="text-[11px] uppercase tracking-wider border-secondary-container"
                      >
                        {books.length} Editions
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-surface-container-highest/50 p-4 border-t border-outline-subtle flex flex-col gap-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">
                    translate
                  </span>
                  Language Editions ({books.length})
                </span>
                <div className="flex gap-2 flex-wrap">
                  {books.map((book: CatalogBookItem) => (
                    <div
                      key={book.id}
                      className="h-6 px-2 bg-surface-container border border-outline-subtle rounded flex items-center gap-2"
                    >
                      <span className="font-label-sm text-label-sm text-text-secondary">
                        {book.language}
                      </span>
                      {book.pairedBookId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed-dim" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          );
        })}

        <div className="mt-4">
          <CatalogPagination
            currentPage={page}
            totalPages={data.pagination?.totalPages || 1}
            baseUrl="/admin/catalog"
          />
        </div>
      </div>
    </div>
  );
}
