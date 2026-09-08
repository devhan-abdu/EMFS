import "server-only";

import {
  googleBooksResponseSchema,
  type GoogleBookSearchResult,
} from "@/lib/validations/google-books";

export type { GoogleBookSearchResult };

function toHttpsThumbnail(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//i, "https://");
}

/**
 * Queries the Google Books volumes API and returns a compact list for admin autofill.
 * Uses GOOGLE_BOOKS_API_KEY when set; unauthenticated requests remain rate-limited.
 */
export async function searchGoogleBooks(
  query: string,
  options?: { maxResults?: number },
): Promise<GoogleBookSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const maxResults = Math.min(Math.max(options?.maxResults ?? 8, 1), 20);
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("printType", "books");
  // Program books are English-only; Amharic editions are entered manually.
  url.searchParams.set("langRestrict", "en");

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Google Books request failed (${response.status}).`);
  }

  const json: unknown = await response.json();
  const parsed = googleBooksResponseSchema.safeParse(json);
  if (!parsed.success) {
    return [];
  }

  return (parsed.data.items ?? [])
    .map((item) => {
      const info = item.volumeInfo;
      const title = info?.title?.trim();
      if (!title) return null;

      return {
        id: item.id,
        title,
        authors: info?.authors?.map((a) => a.trim()).filter(Boolean) ?? [],
        thumbnailUrl: toHttpsThumbnail(
          info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail,
        ),
        pageCount: info?.pageCount ?? null,
        description: info?.description?.trim() || null,
      } satisfies GoogleBookSearchResult;
    })
    .filter((item): item is GoogleBookSearchResult => item !== null);
}
