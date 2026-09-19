import { z } from 'zod';
import { PACE_ADMIN_DUTIES } from '@/db/schema/pace-admin-assignments';

export const assignPaceAdminSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID'),
  paceGroupId: z.string().uuid('Invalid pace group ID'),
  duty: z.enum(PACE_ADMIN_DUTIES),
  assignedBookId: z.string().uuid('Invalid book ID').optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type AssignPaceAdminInput = z.infer<typeof assignPaceAdminSchema>;

export const removePaceAdminAssignmentSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID'),
});
export type RemovePaceAdminAssignmentInput = z.infer<
  typeof removePaceAdminAssignmentSchema
>;

export const listPaceAdminAssignmentsSchema = z.object({
  paceGroupId: z.string().uuid('Invalid pace group ID'),
});
export type ListPaceAdminAssignmentsInput = z.infer<
  typeof listPaceAdminAssignmentsSchema
>;

export const getEligiblePaceAdminsSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  query: z.string().trim().min(2).optional(),
});
export type GetEligiblePaceAdminsInput = z.infer<
  typeof getEligiblePaceAdminsSchema
>;
