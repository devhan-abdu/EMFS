"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import {
  searchGoogleBooksAction,
  type SearchGoogleBooksActionResult,
} from "@/actions/catalog";
import { BookCoverThumb } from "@/components/catalog/book-cover-thumb";
import type { GoogleBookSearchResult } from "@/lib/validations/google-books";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const SEARCH_DEBOUNCE_MS = 400;

type GoogleBooksSearchProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (book: GoogleBookSearchResult) => void;
};

export function GoogleBooksSearch({
  enabled,
  onEnabledChange,
  query,
  onQueryChange,
  onSelect,
}: GoogleBooksSearchProps) {
  const [isSearching, startSearchTransition] = useTransition();
  const [searchResults, setSearchResults] = useState<GoogleBookSearchResult[]>(
    [],
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useDebouncedCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setHasSearched(false);
      return;
    }

    startSearchTransition(async () => {
      const result: SearchGoogleBooksActionResult =
        await searchGoogleBooksAction({ query: trimmed });
      setHasSearched(true);
      if (result.ok) {
        setSearchResults(result.data);
        setSearchError(null);
      } else {
        setSearchResults([]);
        setSearchError(result.errors[0]?.message ?? "Search failed.");
      }
    });
  }, SEARCH_DEBOUNCE_MS);

  function handleQueryChange(value: string) {
    onQueryChange(value);
    runSearch(value);
  }

  function handleSelect(book: GoogleBookSearchResult) {
    onSelect(book);
    setSearchResults([]);
    setSearchError(null);
    setHasSearched(false);
  }

  const showEmptyState =
    enabled &&
    !isSearching &&
    !searchError &&
    hasSearched &&
    query.trim().length >= 2 &&
    searchResults.length === 0;

  return (
    <>
      <div className="flex items-center justify-between rounded-xl bg-surface-container p-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Search Google Books
          </p>
          <p className="text-xs text-muted-foreground">
            English editions only — autofills title, author, pages, and cover
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="relative space-y-2">
          <Label htmlFor="google-search">Find a book</Label>
          <Input
            id="google-search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Search by title or author…"
            autoComplete="off"
          />

          {isSearching && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </p>
          )}

          {searchError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{searchError}</p>
            </div>
          )}

          {showEmptyState && (
            <p className="rounded-xl bg-surface-container p-4 text-xs text-muted-foreground">
              No matches for &ldquo;{query.trim()}&rdquo;. You can still fill in
              the details below by hand.
            </p>
          )}

          {searchResults.length > 0 && (
            <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-border bg-background shadow-md">
              {searchResults.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-container"
                    onClick={() => handleSelect(book)}
                  >
                    <BookCoverThumb
                      coverUrl={book.thumbnailUrl}
                      title={book.title}
                      seed={book.id}
                      alt=""
                      unoptimized
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {book.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {book.authors.length ?
                          book.authors.join(", ")
                        : "Unknown author"}
                        {book.pageCount ? ` · ${book.pageCount} pages` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
