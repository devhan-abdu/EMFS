import { z } from "zod";

export const createWaitlistSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
});

export type CreateWaitlistInput = z.infer<typeof createWaitlistSchema>;

export const removeWaitlistSchema = z.object({
  waitlistId: z.string().uuid("Invalid waitlist entry ID"),
});

export type RemoveWaitlistInput = z.infer<typeof removeWaitlistSchema>;
