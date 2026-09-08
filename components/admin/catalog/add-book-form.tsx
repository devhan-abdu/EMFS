"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createBookAction,
  updateBookAction,
  type CreateBookActionResult,
} from "@/actions/catalog";
import type { GoogleBookSearchResult } from "@/lib/validations/google-books";
import { CoverImageField } from "@/components/admin/catalog/cover-image-field";
import { fieldErrorMap } from "@/components/admin/catalog/field-error-map";
import { FormErrorBanner } from "@/components/admin/catalog/form-error-banner";
import { GoogleBooksSearch } from "@/components/admin/catalog/google-books-search";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCoverImageField } from "@/hooks/use-cover-image-field";
import {
  PROGRAM_BOOK_CATEGORY_PRESETS,
  PROGRAM_BOOK_LANGUAGES,
} from "@/lib/services/constants/admin-catalog-constants";

const initialState: CreateBookActionResult = { ok: false, errors: [] };

async function submitBookAction(
  _: CreateBookActionResult,
  formData: FormData,
  bookId?: string,
): Promise<CreateBookActionResult> {
  if (bookId) {
    return updateBookAction(formData);
  }
  return createBookAction(formData);
}

export type AddBookFormValues = {
  title: string;
  author?: string | null;
  language: string;
  pageCount?: number | null;
  summary?: string | null;
  coverUrl?: string | null;
};

export function AddBookForm({
  bookId,
  initialValues,
  embedded = false,
  onCancel,
  onSuccess,
}: {
  bookId?: string;
  initialValues?: AddBookFormValues;
  embedded?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    (previous: CreateBookActionResult, formData: FormData) =>
      submitBookAction(previous, formData, bookId),
    initialState,
  );
  const errors = state.ok ? {} : fieldErrorMap(state.errors);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [author, setAuthor] = useState(initialValues?.author ?? "");
  const [language, setLanguage] = useState(initialValues?.language ?? "en");
  const [pageCount, setPageCount] = useState(
    initialValues?.pageCount ? String(initialValues.pageCount) : "",
  );
  const [summary, setSummary] = useState(initialValues?.summary ?? "");
  const [categoryPreset, setCategoryPreset] = useState("spiritual");
  const [customCategory, setCustomCategory] = useState("");
  const categoryValue =
    categoryPreset === "other" ? customCategory.trim() : categoryPreset;

  const [searchEnabled, setSearchEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const cover = useCoverImageField();

  useEffect(() => {
    if (initialValues?.coverUrl) cover.applyExternalCoverUrl(initialValues.coverUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues?.coverUrl]);

  useEffect(() => {
    if (state.ok) {
      toast.success(bookId ? "Book updated" : "Book added to the catalog");
      if (onSuccess) onSuccess();
      if (!embedded) {
        router.push("/admin/catalog");
        router.refresh();
      }
    } else if (state.errors?.length) {
      toast.error(state.errors[0]?.message ?? `Failed to ${bookId ? "update" : "create"} book`);
    }
  }, [state, router, bookId, embedded, onSuccess]);

  function applyGoogleBook(book: GoogleBookSearchResult) {
    setTitle(book.title);
    setAuthor(book.authors.join(", "));
    setLanguage("en");
    if (book.pageCount) setPageCount(String(book.pageCount));
    if (book.description) setSummary(book.description.slice(0, 600));
    cover.applyExternalCoverUrl(book.thumbnailUrl);
    setSearchQuery("");
    toast.success("Fields filled from Google Books — review before saving");
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="coverUrl" value={cover.coverUrl} />
      {bookId ? <input type="hidden" name="bookId" value={bookId} /> : null}
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="category" value={categoryValue} />

      <FormErrorBanner title="Failed to create book" message={errors.form} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="card-soft lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl">Book details</CardTitle>

          </CardHeader>
          <CardContent className="space-y-6">
            <GoogleBooksSearch
              enabled={searchEnabled}
              onEnabledChange={setSearchEnabled}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSelect={applyGoogleBook}
            />

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Purification of the Heart"
                required
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  name="author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Hamza Yusuf"
                  aria-invalid={!!errors.author}
                />
                {errors.author && (
                  <p className="text-xs text-destructive">{errors.author}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={categoryPreset}
                  onValueChange={(value) => setCategoryPreset(value ?? "spiritual")}
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAM_BOOK_CATEGORY_PRESETS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoryPreset === "other" && (
                  <Input
                    autoFocus
                    value={customCategory}
                    onChange={(event) => setCustomCategory(event.target.value)}
                    placeholder="Type a category"
                    className="mt-2"
                  />
                )}
                {errors.category && (
                  <p className="text-xs text-destructive">{errors.category}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">
                  Language{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Select
                  value={language}
                  onValueChange={(value) => setLanguage(value ?? "en")}
                >
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue placeholder="Defaults to English" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAM_BOOK_LANGUAGES.map((option) => (
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
                <Label htmlFor="pageCount">Page count</Label>
                <Input
                  id="pageCount"
                  name="pageCount"
                  type="number"
                  min={1}
                  value={pageCount}
                  onChange={(event) => setPageCount(event.target.value)}
                  placeholder="248"
                  required
                  aria-invalid={!!errors.pageCount}
                  aria-describedby="pageCount-hint"
                />
                <p
                  id="pageCount-hint"
                  className="text-xs text-muted-foreground"
                >
                  Used later as the boundary when generating reading tasks.
                </p>
                {errors.pageCount && (
                  <p className="text-xs text-destructive">{errors.pageCount}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">
                Short summary{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="summary"
                name="summary"
                rows={4}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Why this book, and what sisters will take from it…"
              />
              {errors.summary && (
                <p className="text-xs text-destructive">{errors.summary}</p>
              )}
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
              title={title || "Cover"}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        {embedded ? (
          <Button type="button" variant="outline" className="h-12 flex-1" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Link
            href="/admin/catalog"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-border bg-background text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-surface-container"
          >
            Cancel
          </Link>
        )}
        <Button type="submit" className="h-12 flex-1" disabled={isPending}>
          {isPending ?
            <>
              <Loader2 className="size-4 animate-spin" />
              {bookId ? "Updating…" : "Adding…"}
            </>
          : bookId ? "Update book" : "Add book"}
        </Button>
      </div>
    </form>
  );
}

export default AddBookForm;
