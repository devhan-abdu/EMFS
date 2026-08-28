import { z } from "zod";

export const createHandoffSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID."),
});

export type CreateHandoffInput = z.infer<typeof createHandoffSchema>;
