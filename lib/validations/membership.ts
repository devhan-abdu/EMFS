import { z } from "zod";
import { BATCH_MEMBERSHIP_STATUSES } from "@/db/schema/batch-memberships";

export const batchMembershipStatusSchema = z.enum(BATCH_MEMBERSHIP_STATUSES);

export const createMembershipSchema = z.object({
  profileId: z.string().uuid(),
  batchId: z.string().uuid(),
  status: batchMembershipStatusSchema.default("applied"),
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;

export const transitionMembershipSchema = z.object({
  membershipId: z.string().uuid(),
  targetStatus: batchMembershipStatusSchema,
  reason: z.string().optional(),
});

export type TransitionMembershipInput = z.infer<typeof transitionMembershipSchema>;

export const moveMembershipSchema = z.object({
  membershipId: z.string().uuid(),
  newBatchId: z.string().uuid(),
  reason: z.string().min(1, "Reason is required"),
});

export type MoveMembershipInput = z.infer<typeof moveMembershipSchema>;

export const reenterMembershipSchema = z.object({
  profileId: z.string().uuid(),
  fromBatchId: z.string().uuid(),
  toBatchId: z.string().uuid(),
  targetStatus: batchMembershipStatusSchema,
  reason: z.string().min(1, "Reason is required"),
});

export type ReenterMembershipInput = z.infer<typeof reenterMembershipSchema>;
