"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Languages,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteBookAction, reorderBooksAction } from "@/actions/catalog";
import { AddBookForm } from "@/components/admin/catalog/add-book-form";
import {
  AddEditionForm,
  type CatalogBookOption,
} from "@/components/admin/catalog/add-edition-form";
import { BookCoverThumb } from "@/components/catalog/book-cover-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  CatalogBookItem,
  CatalogSlotGroup,
} from "@/lib/services/catalog/get-catalog";

type SortableSlot = CatalogSlotGroup & {
  /** Representative book id for the slot (persisted via reorderBooksAction). */
  id: string;
};

type EditionSheetState =
  | {
      mode: "create";
      pairedBookId: string;
      bookOptions: CatalogBookOption[];
    }
  | {
      mode: "edit";
      edition: CatalogBookItem;
      pairedBookId: string;
      bookOptions: CatalogBookOption[];
    };

type BookSheetState = {
  book: CatalogBookItem;
};

type DeleteBookState = {
  book: CatalogBookItem;
  pairedEditionsCount: number;
};

function pickRepresentative(slot: CatalogSlotGroup): CatalogBookItem {
  const editions = slot.editions;
  return (
    editions.find((edition) => !edition.pairedBookId) ??
    editions.find((edition) => edition.language === "en") ??
    editions[0]!
  );
}

function toSortableSlots(slots: CatalogSlotGroup[]): SortableSlot[] {
  return slots.map((slot) => ({
    ...slot,
    id: pickRepresentative(slot).id,
  }));
}

function toBookOption(book: CatalogBookItem): CatalogBookOption {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    language: book.language,
    sequenceOrder: book.sequenceOrder,
  };
}

type CatalogSortableListProps = {
  slots: CatalogSlotGroup[];
};

export function CatalogSortableList({ slots }: CatalogSortableListProps) {
  const router = useRouter();
  const [items, setItems] = useState(() => toSortableSlots(slots));
  const [isPending, startTransition] = useTransition();
  const [editionSheet, setEditionSheet] = useState<EditionSheetState | null>(
    null,
  );
  const [bookSheet, setBookSheet] = useState<BookSheetState | null>(null);
  const [deleteBook, setDeleteBook] = useState<DeleteBookState | null>(null);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(toSortableSlots(slots));
  }, [slots]);

  const pageSlotNumbers = useMemo(
    () => slots.map((slot) => slot.slot).sort((a, b) => a - b),
    [slots],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || isPending) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setPendingRowId(String(active.id));

    startTransition(async () => {
      const result = await reorderBooksAction(next.map((item) => item.id));
      setPendingRowId(null);
      if (result.ok) {
        toast.success("Reading order updated.");
        router.refresh();
        return;
      }

      setItems(previous);
      toast.error(result.errors[0]?.message ?? "Failed to reorder books.");
    });
  }

  function openEditBook(item: SortableSlot) {
    setBookSheet({ book: pickRepresentative(item) });
  }

  function confirmDeleteBook() {
    if (!deleteBook) return;
    const { book } = deleteBook;
    setPendingRowId(book.id);
    startTransition(async () => {
      const result = await deleteBookAction({ bookId: book.id });
      setPendingRowId(null);
      setDeleteBook(null);
      if (result.ok) {
        toast.success(`Deleted ${book.title}.`);
        router.refresh();
      } else {
        toast.error(
          result.errors[0]?.message ?? `Failed to delete ${book.title}.`,
        );
      }
    });
  }

  function openCreateEdition(item: SortableSlot) {
    const program = pickRepresentative(item);
    setEditionSheet({
      mode: "create",
      pairedBookId: program.id,
      bookOptions: [toBookOption(program)],
    });
  }

  function openEditEdition(item: SortableSlot, edition: CatalogBookItem) {
    const program = pickRepresentative(item);
    setEditionSheet({
      mode: "edit",
      edition,
      pairedBookId: program.id,
      bookOptions: [toBookOption(program)],
    });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {items.map((item, index) => (
              <SortableCatalogRow
                key={item.id}
                item={item}
                displaySlot={pageSlotNumbers[index] ?? item.slot}
                disabled={isPending}
                onAddEdition={() => openCreateEdition(item)}
                onEditEdition={(edition) => openEditEdition(item, edition)}
                onEditBook={() => openEditBook(item)}
                onDeleteBook={() =>
                  setDeleteBook({
                    book: pickRepresentative(item),
                    pairedEditionsCount: Math.max(0, item.editions.length - 1),
                  })
                }
                isRowPending={pendingRowId === item.id}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Sheet
        open={editionSheet !== null}
        onOpenChange={(open) => {
          if (!open) setEditionSheet(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader>
            <SheetTitle>
              {editionSheet?.mode === "edit" ?
                "Edit language edition"
              : "Add language edition"}
            </SheetTitle>
            <SheetDescription>
              {editionSheet?.mode === "edit" ?
                "Update this paired edition. Changes save without leaving the catalog."
              : "Attach an Amharic edition to this program book."}
            </SheetDescription>
          </SheetHeader>

          {editionSheet ?
            <div className="px-4 pb-8">
              <AddEditionForm
                key={
                  editionSheet.mode === "edit" ?
                    editionSheet.edition.id
                  : `create-${editionSheet.pairedBookId}`
                }
                books={editionSheet.bookOptions}
                defaultPairedBookId={editionSheet.pairedBookId}
                editionId={
                  editionSheet.mode === "edit" ?
                    editionSheet.edition.id
                  : undefined
                }
                initialValues={
                  editionSheet.mode === "edit" ?
                    {
                      title: editionSheet.edition.title,
                      language: editionSheet.edition.language,
                      author: editionSheet.edition.author,
                      pageCount: editionSheet.edition.pageCount,
                      coverUrl: editionSheet.edition.coverUrl,
                    }
                  : undefined
                }
                embedded
                onCancel={() => setEditionSheet(null)}
                onSuccess={() => setEditionSheet(null)}
              />
            </div>
          : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={bookSheet !== null}
        onOpenChange={(open) => {
          if (!open) setBookSheet(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader>
            <SheetTitle>Edit book</SheetTitle>
            <SheetDescription>
              Update this program book without leaving the catalog.
            </SheetDescription>
          </SheetHeader>
          {bookSheet ?
            <div className="px-4 pb-8">
              <AddBookForm
                key={bookSheet.book.id}
                bookId={bookSheet.book.id}
                embedded
                initialValues={bookSheet.book}
                onCancel={() => setBookSheet(null)}
                onSuccess={() => {
                  setBookSheet(null);
                  router.refresh();
                }}
              />
            </div>
          : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteBook !== null}
        onOpenChange={(open) => !open && setDeleteBook(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete book?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove {deleteBook?.pairedEditionsCount ?? 0}{" "}
              paired editions. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBook}>
              Delete book
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SortableCatalogRow({
  item,
  displaySlot,
  disabled,
  onAddEdition,
  onEditEdition,
  onEditBook,
  onDeleteBook,
  isRowPending,
}: {
  item: SortableSlot;
  displaySlot: number;
  disabled: boolean;
  onAddEdition: () => void;
  onEditEdition: (edition: CatalogBookItem) => void;
  onEditBook: () => void;
  onDeleteBook: () => void;
  isRowPending: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: disabled || isRowPending });

  const primary = pickRepresentative(item);
  const languageEditions = item.editions.filter(
    (edition) => edition.id !== primary.id,
  );
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "card-soft",
        isDragging && "z-10 opacity-90 shadow-md",
        (disabled || isRowPending) && !isDragging && "opacity-70",
      )}
    >
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-6">
        <div className="flex items-center gap-3 md:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
            disabled={disabled || isRowPending}
            aria-label={`Drag to reorder slot ${displaySlot}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4 text-muted-foreground" />
          </Button>

         
          <div className="relative shrink-0">
            <BookCoverThumb
              coverUrl={primary.coverUrl}
              title={primary.title}
              seed={primary.id}
              sizes="96px"
              className="h-[109px] w-20 rounded-xl shadow-sm md:h-[131px] md:w-24"
            />
            <div
              aria-hidden
              className="absolute -left-3 -top-3 flex min-w-10 items-center justify-center rounded-2xl border-2 border-background bg-primary px-1.5 py-1 font-display text-xl font-extrabold leading-none tabular-nums text-primary-foreground shadow-md md:-left-4 md:-top-4 md:min-w-12 md:px-2 md:text-3xl"
            >
              {displaySlot}
            </div>
            <span className="sr-only">Slot {displaySlot}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {primary.title}
            </h2>
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                disabled={disabled || isRowPending}
                aria-label={`Actions for ${primary.title}`}
              >
                {isRowPending ?
                  <Loader2 className="size-4 animate-spin" />
                : <MoreVertical className="size-4" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditBook}>
                  Edit book
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDeleteBook}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete book
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-sm text-muted-foreground">
            {primary.author ?? "Unknown author"} ·{" "}
            {item.editions.reduce(
              (count, edition) => count + (edition.tasksCount ?? 0),
              0,
            )}{" "}
            tasks
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {languageEditions.map((ed) => (
              <button
                key={ed.id}
                type="button"
                disabled={disabled || isRowPending}
                onClick={() => onEditEdition(ed)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
              >
                <Languages className="size-4 text-secondary" />
                {ed.language}
                {ed.pairedBookId ?
                  <span className="rounded-full bg-secondary/15 px-2 text-xs font-medium text-secondary-foreground">
                    paired
                  </span>
                : null}
              </button>
            ))}

            {languageEditions.length === 0 ?
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={onAddEdition}
                className="rounded-full"
              >
                <Plus className="size-4" />
                Add edition
              </Button>
            : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
