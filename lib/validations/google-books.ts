import { z } from "zod";

export const searchGoogleBooksSchema = z.object({
  query: z.string().trim().min(2, "Enter at least 2 characters").max(200),
});

const googleVolumeSchema = z.object({
  id: z.string(),
  volumeInfo: z
    .object({
      title: z.string().optional(),
      authors: z.array(z.string()).optional(),
      description: z.string().optional(),
      pageCount: z.number().int().positive().optional(),
      imageLinks: z
        .object({
          thumbnail: z.string().optional(),
          smallThumbnail: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const googleBooksResponseSchema = z.object({
  items: z.array(googleVolumeSchema).optional(),
});

export type SearchGoogleBooksInput = z.infer<typeof searchGoogleBooksSchema>;

export type GoogleBookSearchResult = {
  id: string;
  title: string;
  authors: string[];
  thumbnailUrl: string | null;
  pageCount: number | null;
  description: string | null;
};
