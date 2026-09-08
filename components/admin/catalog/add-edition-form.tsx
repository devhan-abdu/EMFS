"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addPairedEditionAction,
  type AddPairedEditionActionResult,
} from "@/actions/catalog";
import { CoverImageField } from "@/components/admin/catalog/cover-image-field";
import { fieldErrorMap } from "@/components/admin/catalog/field-error-map";
import { FormErrorBanner } from "@/components/admin/catalog/form-error-banner";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCoverImageField } from "@/hooks/use-cover-image-field";
import { EDITION_LANGUAGES } from "@/lib/services/constants/admin-catalog-constants";
import { cn } from "@/lib/utils";

const initialState: AddPairedEditionActionResult = { ok: false, errors: [] };

function isConflictResult(
  result: AddPairedEditionActionResult,
): result is Extract<AddPairedEditionActionResult, { conflict: true }> {
  return !result.ok && "conflict" in result && result.conflict === true;
}

async function submitEditionAction(
  _: AddPairedEditionActionResult,
  formData: FormData,
): Promise<AddPairedEditionActionResult> {
  return addPairedEditionAction(formData);
}

export type CatalogBookOption = {
  id: string;
  title: string;
  author?: string | null;
  language?: string;
  sequenceOrder?: number;
  label?: string;
};

export type EditionFormInitialValues = {
  title?: string;
  language?: string;
  author?: string | null;
  pageCount?: number | null;
  coverUrl?: string | null;
};

type AddEditionFormProps = {
  books: CatalogBookOption[];
  /** Edit mode — updates this edition instead of creating. */
  editionId?: string;
  /** Prefill / lock the program book pairing. */
  defaultPairedBookId?: string;
  initialValues?: EditionFormInitialValues;
  cancelHref?: string;
  successHref?: string;
  /** When set, skip navigation and call this after a successful save. */
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Compact layout for Sheet / Dialog embedding. */
  embedded?: boolean;
};

export function AddEditionForm({
  books,
  editionId,
  defaultPairedBookId = "",
  initialValues,
  cancelHref = "/admin/catalog",
  successHref = "/admin/catalog",
  onSuccess,
  onCancel,
  embedded = false,
}: AddEditionFormProps) {
  const router = useRouter();
  const isEdit = Boolean(editionId);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    submitEditionAction,
    initialState,
  );
  const errors = state.ok ? {} : fieldErrorMap(state.errors);

  const [pairedBookId, setPairedBookId] = useState(
    defaultPairedBookId || "",
  );
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [language, setLanguage] = useState(initialValues?.language ?? "am");
  const [author, setAuthor] = useState(initialValues?.author ?? "");
  const [pageCount, setPageCount] = useState(
    initialValues?.pageCount != null ? String(initialValues.pageCount) : "",
  );
  const [overrideEditionId, setOverrideEditionId] = useState("");
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictEditionId, setConflictEditionId] = useState<string | null>(
    null,
  );
  const [conflictMessage, setConflictMessage] = useState("");

  const cover = useCoverImageField();

  useEffect(() => {
    if (initialValues?.coverUrl) {
      cover.applyExternalCoverUrl(initialValues.coverUrl);
    }
    // Intentionally once on mount (sheet remounts via key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.ok) {
      toast.success(
        isEdit || overrideEditionId
          ? "Edition updated."
          : "Edition added to the catalog",
      );
      setOverrideEditionId("");
      setConflictOpen(false);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(successHref);
      }
      router.refresh();
      return;
    }

    if (isConflictResult(state)) {
      setConflictEditionId(state.existingEditionId);
      setConflictMessage(state.message);
      setConflictOpen(true);
      return;
    }

    if ("errors" in state && state.errors?.length) {
      toast.error(
        state.errors[0]?.message ??
          (isEdit ? "Failed to update edition" : "Failed to add edition"),
      );
    }
  }, [state, router, successHref, onSuccess, isEdit, overrideEditionId]);

  useEffect(() => {
    if (!overrideEditionId) return;
    formRef.current?.requestSubmit();
  }, [overrideEditionId]);

  function handleOverwrite() {
    if (!conflictEditionId) return;
    setConflictOpen(false);
    setOverrideEditionId(conflictEditionId);
  }

  const bookOptions = books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author ?? null,
    label: book.author ? `${book.title} — ${book.author}` : book.title,
  }));
  const selectedBook = bookOptions.find((book) => book.id === pairedBookId);
  const lockBookPicker = Boolean(defaultPairedBookId) || isEdit;

  const cancelControl =
    onCancel ?
      <Button
        type="button"
        variant="outline"
        className="h-12 flex-1"
        onClick={onCancel}
      >
        Cancel
      </Button>
    : <Link
        href={cancelHref}
        className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-border bg-background text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-surface-container"
      >
        Cancel
      </Link>;

  return (
    <>
    <form
      ref={formRef}
      action={formAction}
      className={cn(
        "w-full space-y-6",
        embedded ? "max-w-none" : "mx-left max-w-5xl",
      )}
    >
      <input type="hidden" name="coverUrl" value={cover.coverUrl} />
      <input type="hidden" name="pairedBookId" value={pairedBookId} />
      <input type="hidden" name="language" value={language} />
      {editionId ?
        <input type="hidden" name="editionId" value={editionId} />
      : null}
      {overrideEditionId ?
        <input type="hidden" name="overrideEditionId" value={overrideEditionId} />
      : null}

      <FormErrorBanner
        title={isEdit ? "Failed to update edition" : "Failed to add edition"}
        message={errors.form}
      />

      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">Program book</CardTitle>
          <CardDescription>
            {lockBookPicker
              ? "This edition pairs with the selected program book."
              : "Choose the English program book this Amharic edition pairs with."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pairedBookId">Select book</Label>
            <Popover
              open={bookPickerOpen}
              onOpenChange={setBookPickerOpen}
            >
              <PopoverTrigger
                render={
                  <Button
                    id="pairedBookId"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={bookPickerOpen}
                    disabled={books.length === 0 || lockBookPicker}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedBook?.label ?? "Search books…"}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                }
              />
              <PopoverContent
                className="w-[var(--anchor-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Type a title or author…" />
                  <CommandList>
                    <CommandEmpty>No books found.</CommandEmpty>
                    <CommandGroup>
                      {bookOptions.map((book) => (
                        <CommandItem
                          key={book.id}
                          value={book.label}
                          onSelect={() => {
                            setPairedBookId(book.id);
                            setBookPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4 shrink-0",
                              pairedBookId === book.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate">{book.title}</span>
                            {book.author && (
                              <span className="truncate text-xs text-muted-foreground">
                                {book.author}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.pairedBookId && (
              <p className="text-xs text-destructive">{errors.pairedBookId}</p>
            )}
            {books.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No books available. Add a program book first.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div
        className={cn(
          "grid gap-6",
          embedded ? "grid-cols-1" : "lg:grid-cols-3",
        )}
      >
        <Card className={cn("card-soft", !embedded && "lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              Edition details
            </CardTitle>
            <CardDescription>
              {isEdit
                ? "Update this language edition."
                : "Enter the Amharic translation details manually."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="edition-title">Title</Label>
              <Input
                id="edition-title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. አቶሚክ ልማዶች"
                required
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edition-language">Language</Label>
                <Select
                  value={language}
                  onValueChange={(value) => setLanguage(value ?? "am")}
                >
                  <SelectTrigger id="edition-language" className="w-full">
                    <SelectValue placeholder="Select language…" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITION_LANGUAGES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.language && (
                  <p className="text-xs text-destructive">{errors.language}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edition-author">
                  Author / translator{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="edition-author"
                  name="author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Leave blank to inherit from the program book"
                  aria-invalid={!!errors.author}
                />
                {errors.author && (
                  <p className="text-xs text-destructive">{errors.author}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edition-pageCount">Page count</Label>
                <Input
                  id="edition-pageCount"
                  name="pageCount"
                  type="number"
                  min={1}
                  value={pageCount}
                  onChange={(event) => setPageCount(event.target.value)}
                  placeholder="248"
                  required
                  aria-invalid={!!errors.pageCount}
                />
                {errors.pageCount && (
                  <p className="text-xs text-destructive">{errors.pageCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl">Book Cover</CardTitle>
          </CardHeader>
          <CardContent>
            <CoverImageField
              coverPreview={cover.coverPreview}
              coverError={errors.cover}
              fileInputRef={cover.fileInputRef}
              onFileChange={cover.handleFileChange}
              onClear={cover.clearCover}
              onTriggerUpload={cover.triggerFileInput}
              description="Upload a local cover image for this Amharic edition."
              title={title || "Cover"}
              seed={pairedBookId || title || "Cover"}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
        {cancelControl}
        <Button
          type="submit"
          className="h-12 flex-1"
          disabled={isPending || books.length === 0 || !pairedBookId}
        >
          {isPending ?
            <>
              <Loader2 className="size-4 animate-spin" />
              {isEdit ? "Saving…" : "Adding…"}
            </>
          : isEdit ?
            "Save edition"
          : "Add edition"}
        </Button>
      </div>
    </form>

    <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Edition already exists for this language
          </AlertDialogTitle>
          <AlertDialogDescription>
            {conflictMessage ||
              "An edition already exists for this language — overwrite it?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleOverwrite}>
            Overwrite
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default AddEditionForm;
