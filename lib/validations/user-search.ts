import { z } from "zod";

export const searchProfilesSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Search query must be at least 2 characters"),
  limit: z
    .coerce
    .number({ message: "Limit must be a number" })
    .int("Limit must be an integer")
    .positive("Limit must be a positive integer")
    .optional()
    .default(25),
  excludeProfileIds: z
    .array(z.string().uuid("Invalid profile UUID"))
    .optional()
    .default([]),
});
export type SearchProfilesInput = z.infer<typeof searchProfilesSchema>;
export type SearchProfilesRawInput = z.input<typeof searchProfilesSchema>;

// Shared across service + client — one shape for both search results

export type KnownBatchAdminBatch = { id: string; name: string };
export type ProfileSearchResult = {
  profileId: string;
  displayName: string;
  email: string;
  adminOfBatches?: KnownBatchAdminBatch[];
};
