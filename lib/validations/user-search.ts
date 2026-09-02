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

export type SearchProfilesInput = {
  query: string;
  limit?: number;
  excludeProfileIds?: string[];
};
