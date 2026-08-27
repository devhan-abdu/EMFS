import { z } from "zod";

export const createHandoffSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID."),
  adminContactShown: z.string().min(1, "Admin contact information must be provided."),
});

export type CreateHandoffInput = z.infer<typeof createHandoffSchema>;
