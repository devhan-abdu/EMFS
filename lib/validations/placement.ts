import { z } from 'zod';
import { PACE_GROUP_PREFERENCES } from '@/db/schema/applications';

export const placementStatusFilterSchema = z.enum([
  'all',
  'placed',
  'unplaced',
]);
export type PlacementStatusFilter = z.infer<typeof placementStatusFilterSchema>;

export const pacePreferenceFilterSchema = z.enum([
  'all',
  ...PACE_GROUP_PREFERENCES,
]);
export type PacePreferenceFilter = z.infer<typeof pacePreferenceFilterSchema>;

export const getBatchRosterFilterSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  placementStatus: placementStatusFilterSchema.optional().default('all'),
  pacePreference: pacePreferenceFilterSchema.optional().default('all'),
  search: z.string().trim().optional(),
});
export type GetBatchRosterFilterInput = z.input<
  typeof getBatchRosterFilterSchema
>;

export const assignMemberPaceGroupSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  profileId: z.string().uuid('Invalid profile ID'),
  paceGroupId: z.string().uuid('Invalid pace group ID'),
  notes: z.string().trim().max(1000).optional(),
});
export type AssignMemberPaceGroupInput = z.infer<
  typeof assignMemberPaceGroupSchema
>;

export const moveMemberPaceGroupSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  profileId: z.string().uuid('Invalid profile ID'),
  toPaceGroupId: z.string().uuid('Invalid target pace group ID'),
  moveReason: z.string().trim().min(1, 'Move reason is required').max(500),
  notes: z.string().trim().max(1000).optional(),
});
export type MoveMemberPaceGroupInput = z.infer<
  typeof moveMemberPaceGroupSchema
>;

export const bulkAssignMembersPaceGroupSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  targetGroupId: z.string().uuid('Invalid target pace group ID'),
  profileIds: z
    .array(z.string().uuid('Invalid profile ID'))
    .min(1, 'At least one member must be selected'),
  notes: z.string().trim().max(1000).optional(),
});
export type BulkAssignMembersPaceGroupInput = z.infer<
  typeof bulkAssignMembersPaceGroupSchema
>;

export const createMoveRequestSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  profileId: z.string().uuid('Invalid profile ID'),
  toPaceGroupId: z.string().uuid('Invalid target pace group ID'),
  reason: z.string().trim().max(500).optional(),
});
export type CreateMoveRequestInput = z.infer<typeof createMoveRequestSchema>;

export const approveMoveRequestSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  batchId: z.string().uuid('Invalid batch ID'),
  notes: z.string().trim().max(1000).optional(),
});
export type ApproveMoveRequestInput = z.infer<typeof approveMoveRequestSchema>;

export const rejectMoveRequestSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  batchId: z.string().uuid('Invalid batch ID'),
  rejectionReason: z.string().trim().max(500).optional(),
});
export type RejectMoveRequestInput = z.infer<typeof rejectMoveRequestSchema>;

export const getMoveHistoryFilterSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});
export type GetMoveHistoryFilterInput = z.infer<
  typeof getMoveHistoryFilterSchema
>;
