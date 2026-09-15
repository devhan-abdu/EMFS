import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  paceAdminAssignments,
  PaceAdminDuty,
  paceGroups,
  profiles,
} from '@/db/schema';
import type {
  AssignPaceAdminInput,
  RemovePaceAdminAssignmentInput,
  ListPaceAdminAssignmentsInput,
} from '@/lib/validations/pace-admin';

export type PaceAdminErrorCode =
  | 'PACE_GROUP_NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'ASSIGNMENT_NOT_FOUND'
  | 'DUPLICATE_ASSIGNMENT';

export class PaceAdminError extends Error {
  code: PaceAdminErrorCode;
  constructor(code: PaceAdminErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PaceAdminError';
  }
}

export type PaceAdminAssignmentRow = {
  id: string;
  profileId: string;
  paceGroupId: string;
  duty: string;
  assignedBookId: string | null;
};
export type PaceAdminAssignmentDetailRow = {
  id: string;
  duty: PaceAdminDuty;
  notes: string | null;
  createdAt: Date;
  profile: {
    id: string;
    fullName: string | null;
    email: string;
  };
  book: {
    id: string;
    title: string;
  } | null;
};

const ASSIGNMENT_RETURNING = {
  id: paceAdminAssignments.id,
  profileId: paceAdminAssignments.profileId,
  paceGroupId: paceAdminAssignments.paceGroupId,
  duty: paceAdminAssignments.duty,
  assignedBookId: paceAdminAssignments.assignedBookId,
};

export async function getPaceAdminAssignmentById(assignmentId: string) {
  const [existing] = await db
    .select({
      id: paceAdminAssignments.id,
      paceGroupId: paceAdminAssignments.paceGroupId,
    })
    .from(paceAdminAssignments)
    .where(eq(paceAdminAssignments.id, assignmentId))
    .limit(1);

  return existing ?? null;
}

export async function assignPaceAdmin(
  input: AssignPaceAdminInput,
  assignedByProfileId: string,
): Promise<PaceAdminAssignmentRow> {
  const { profileId, paceGroupId, duty, assignedBookId, notes } = input;

  const [group] = await db
    .select({ id: paceGroups.id })
    .from(paceGroups)
    .where(eq(paceGroups.id, paceGroupId))
    .limit(1);

  if (!group) {
    throw new PaceAdminError('PACE_GROUP_NOT_FOUND', 'Pace group not found.');
  }

  return db.transaction(async (tx) => {
    const [targetProfile] = await tx
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!targetProfile) {
      throw new PaceAdminError('PROFILE_NOT_FOUND', 'Profile not found.');
    }

    const [existing] = await tx
      .select({ id: paceAdminAssignments.id })
      .from(paceAdminAssignments)
      .where(
        and(
          eq(paceAdminAssignments.profileId, profileId),
          eq(paceAdminAssignments.paceGroupId, paceGroupId),
          eq(paceAdminAssignments.duty, duty),
        ),
      )
      .limit(1);

    if (existing) {
      throw new PaceAdminError(
        'DUPLICATE_ASSIGNMENT',
        'This person already holds this duty in this pace group.',
      );
    }

    const [created] = await tx
      .insert(paceAdminAssignments)
      .values({
        profileId,
        paceGroupId,
        duty,
        assignedBookId,
        assignedBy: assignedByProfileId,
        notes,
      })
      .returning(ASSIGNMENT_RETURNING);

    if (targetProfile.role === 'member') {
      await tx
        .update(profiles)
        .set({ role: 'pace_admin', updatedAt: new Date() })
        .where(eq(profiles.id, profileId));
    }

    return created;
  });
}

export async function removePaceAdminAssignment(
  input: RemovePaceAdminAssignmentInput,
): Promise<{ id: string }> {
  const { assignmentId } = input;

  const existing = await getPaceAdminAssignmentById(assignmentId);
  if (!existing) {
    throw new PaceAdminError('ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  }

  await db
    .delete(paceAdminAssignments)
    .where(eq(paceAdminAssignments.id, assignmentId));

  return { id: assignmentId };
}

export async function listPaceAdminAssignments(
  input: ListPaceAdminAssignmentsInput,
): Promise<PaceAdminAssignmentDetailRow[]> {
  const { paceGroupId } = input;

  const [group] = await db
    .select({ id: paceGroups.id })
    .from(paceGroups)
    .where(eq(paceGroups.id, paceGroupId))
    .limit(1);

  if (!group) {
    throw new PaceAdminError('PACE_GROUP_NOT_FOUND', 'Pace group not found.');
  }

  const rows = await db.query.paceAdminAssignments.findMany({
    where: eq(paceAdminAssignments.paceGroupId, paceGroupId),
    orderBy: (assignments, { asc }) => [asc(assignments.createdAt)],
    with: {
      profile: {
        columns: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      book: {
        columns: {
          id: true,
          title: true,
        },
      },
    },
  });

  return rows;
}
