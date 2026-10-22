import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { db } from '@/db';
import {
  batchAdmins,
  batches,
  batchMemberships,
  books,
  paceAdminAssignments,
  paceGroupMemberships,
  paceGroups,
  profiles,
  roleAuditLogs,
  user,
  type PaceAdminDuty,
  type RoleAssignmentChange,
} from '@/db/schema';
import type { Role } from '@/lib/auth/authorize';
import type {
  ChangeUserRoleInput,
  ListUsersInput,
} from '@/lib/validations/user-management';

export type UserManagementErrorCode =
  | 'LAST_SUPER_ADMIN'
  | 'LAST_BATCH_ADMIN'
  | 'SELF_DEMOTION'
  | 'PROFILE_NOT_FOUND'
  | 'INVALID_SCOPE'
  | 'TRANSACTION_FAILED';

export class UserManagementError extends Error {
  code: UserManagementErrorCode;
  constructor(code: UserManagementErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'UserManagementError';
  }
}

export type AdminScopeSummary = {
  isSuperAdmin: boolean;
  batchNames: string[];
  paceGroupDetails: { groupName: string; duty: string }[];
  summaryText: string;
};

export type UserListItem = {
  id: string; // profileId
  authUserId: string;
  name: string;
  email: string;
  telegramUsername: string | null;
  telegramLinked: boolean;
  role: Role;
  isSuperAdmin: boolean;
  scopeSummary: AdminScopeSummary;
  createdAt: Date;
};

export type ListUsersResult = {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type UserAuditHistoryItem = {
  id: string;
  previousRole: Role;
  newRole: Role;
  previousIsSuperAdmin: boolean;
  newIsSuperAdmin: boolean;
  actorName: string;
  actorEmail: string | null;
  assignmentChanges: RoleAssignmentChange | null;
  reason: string | null;
  createdAt: Date;
};

export type UserDetails = {
  profile: {
    id: string;
    authUserId: string;
    name: string;
    firstName: string | null;
    fatherName: string | null;
    grandfatherName: string | null;
    email: string;
    phone: string | null;
    telegramUsername: string | null;
    telegramLinked: boolean;
    role: Role;
    isSuperAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  scopeSummary: AdminScopeSummary;
  batchAdminAssignments: {
    batchId: string;
    batchName: string;
    registrationOpen: boolean;
    startDate: string | null;
  }[];
  paceAdminAssignments: {
    id: string;
    paceGroupId: string;
    paceGroupName: string;
    batchId: string;
    batchName: string;
    duty: PaceAdminDuty;
    assignedBookTitle: string | null;
    notes: string | null;
    createdAt: Date;
  }[];
  memberships: {
    batchMemberships: {
      id: string;
      batchId: string;
      batchName: string;
      status: string;
      enrolledAt: Date;
    }[];
    paceGroupMemberships: {
      id: string;
      paceGroupId: string;
      paceGroupName: string;
      batchName: string;
      status: string;
    }[];
  };
  roleHistory: UserAuditHistoryItem[];
};

/**
 * EMF-59: Super Admin-only user list with server-side pagination, newest first,
 * multi-field search, multi-faceted filtering, and administrative scope summaries.
 */
export async function listUsers(
  input: ListUsersInput,
): Promise<ListUsersResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 50);
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [];

  // Search across name, email, Telegram username, and full name
  if (input.q && input.q.trim().length > 0) {
    const pattern = `%${input.q.trim()}%`;
    conditions.push(
      or(
        ilike(user.name, pattern),
        ilike(user.email, pattern),
        ilike(profiles.firstName, pattern),
        ilike(profiles.fatherName, pattern),
        ilike(profiles.telegramUsername, pattern),
        sql`concat(${profiles.firstName}, ' ', ${profiles.fatherName}) ILIKE ${pattern}`,
      )!,
    );
  }

  // Telegram filter
  if (input.telegram === 'linked') {
    conditions.push(
      and(
        sql`${profiles.telegramUsername} IS NOT NULL`,
        sql`${profiles.telegramUsername} != ''`,
      )!,
    );
  } else if (input.telegram === 'unlinked') {
    conditions.push(
      or(
        sql`${profiles.telegramUsername} IS NULL`,
        sql`${profiles.telegramUsername} = ''`,
      )!,
    );
  }

  // Role filter based on authoritative records
  if (input.role && input.role !== 'all') {
    if (input.role === 'super_admin') {
      conditions.push(eq(profiles.isSuperAdmin, true));
    } else if (input.role === 'batch_admin') {
      const batchAdminExists = exists(
        db
          .select({ dummy: sql`1` })
          .from(batchAdmins)
          .where(eq(batchAdmins.profileId, profiles.id)),
      );
      conditions.push(and(eq(profiles.isSuperAdmin, false), batchAdminExists)!);
    } else if (input.role === 'pace_admin') {
      const paceAdminExists = exists(
        db
          .select({ dummy: sql`1` })
          .from(paceAdminAssignments)
          .where(eq(paceAdminAssignments.profileId, profiles.id)),
      );
      conditions.push(and(eq(profiles.isSuperAdmin, false), paceAdminExists)!);
    } else if (input.role === 'member') {
      conditions.push(
        and(
          eq(profiles.isSuperAdmin, false),
          notExists(
            db
              .select({ dummy: sql`1` })
              .from(batchAdmins)
              .where(eq(batchAdmins.profileId, profiles.id)),
          ),
          notExists(
            db
              .select({ dummy: sql`1` })
              .from(paceAdminAssignments)
              .where(eq(paceAdminAssignments.profileId, profiles.id)),
          ),
        )!,
      );
    }
  }

  // Batch filter: user either administers the batch OR is a member of it
  if (input.batchId) {
    const isBatchAdminForBatch = exists(
      db
        .select({ dummy: sql`1` })
        .from(batchAdmins)
        .where(
          and(
            eq(batchAdmins.profileId, profiles.id),
            eq(batchAdmins.batchId, input.batchId),
          ),
        ),
    );
    const isMemberOfBatch = exists(
      db
        .select({ dummy: sql`1` })
        .from(batchMemberships)
        .where(
          and(
            eq(batchMemberships.profileId, profiles.id),
            eq(batchMemberships.batchId, input.batchId),
          ),
        ),
    );
    conditions.push(or(isBatchAdminForBatch, isMemberOfBatch)!);
  }

  // Pace group filter: user either administers the pace group OR is a member of it
  if (input.paceGroupId) {
    const isPaceAdminForGroup = exists(
      db
        .select({ dummy: sql`1` })
        .from(paceAdminAssignments)
        .where(
          and(
            eq(paceAdminAssignments.profileId, profiles.id),
            eq(paceAdminAssignments.paceGroupId, input.paceGroupId),
          ),
        ),
    );
    const isMemberOfGroup = exists(
      db
        .select({ dummy: sql`1` })
        .from(paceGroupMemberships)
        .where(
          and(
            eq(paceGroupMemberships.profileId, profiles.id),
            eq(paceGroupMemberships.paceGroupId, input.paceGroupId),
          ),
        ),
    );
    conditions.push(or(isPaceAdminForGroup, isMemberOfGroup)!);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total count
  const [countResult] = await db
    .select({ total: count() })
    .from(profiles)
    .innerJoin(user, eq(profiles.authUserId, user.id))
    .where(whereClause);

  const total = Number(countResult?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize) || 1;

  if (total === 0) {
    return {
      users: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  // Paged users query: newest first (profiles.createdAt DESC)
  const rows = await db
    .select({
      id: profiles.id,
      authUserId: profiles.authUserId,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      userName: user.name,
      email: user.email,
      telegramUsername: profiles.telegramUsername,
      role: profiles.role,
      isSuperAdmin: profiles.isSuperAdmin,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .innerJoin(user, eq(profiles.authUserId, user.id))
    .where(whereClause)
    .orderBy(desc(profiles.createdAt))
    .limit(pageSize)
    .offset(offset);

  const profileIds = rows.map((r) => r.id);

  // Fetch administrative scopes for the current page
  const [batchRows, paceRows] = await Promise.all([
    profileIds.length > 0
      ? db
          .select({
            profileId: batchAdmins.profileId,
            batchId: batches.id,
            batchName: batches.name,
          })
          .from(batchAdmins)
          .innerJoin(batches, eq(batchAdmins.batchId, batches.id))
          .where(inArray(batchAdmins.profileId, profileIds))
      : [],
    profileIds.length > 0
      ? db
          .select({
            profileId: paceAdminAssignments.profileId,
            groupId: paceGroups.id,
            groupName: paceGroups.name,
            duty: paceAdminAssignments.duty,
          })
          .from(paceAdminAssignments)
          .innerJoin(
            paceGroups,
            eq(paceAdminAssignments.paceGroupId, paceGroups.id),
          )
          .where(inArray(paceAdminAssignments.profileId, profileIds))
      : [],
  ]);

  const batchesByProfile = new Map<string, string[]>();
  for (const b of batchRows) {
    const list = batchesByProfile.get(b.profileId) ?? [];
    list.push(b.batchName);
    batchesByProfile.set(b.profileId, list);
  }

  const paceByProfile = new Map<
    string,
    { groupName: string; duty: string }[]
  >();
  for (const p of paceRows) {
    const list = paceByProfile.get(p.profileId) ?? [];
    list.push({ groupName: p.groupName, duty: p.duty });
    paceByProfile.set(p.profileId, list);
  }

  const users: UserListItem[] = rows.map((r) => {
    const bNames = batchesByProfile.get(r.id) ?? [];
    const pDetails = paceByProfile.get(r.id) ?? [];

    let summaryText = 'Member';
    if (r.isSuperAdmin) {
      summaryText = 'Super Admin (Global)';
    } else if (bNames.length > 0 && pDetails.length > 0) {
      summaryText = `Batch Admin (${bNames.join(', ')}) · Pace Admin (${pDetails.map((p) => p.groupName).join(', ')})`;
    } else if (bNames.length > 0) {
      summaryText = `Batch Admin: ${bNames.join(', ')}`;
    } else if (pDetails.length > 0) {
      const distinctGroups = Array.from(
        new Set(pDetails.map((p) => p.groupName)),
      );
      summaryText = `Pace Admin: ${distinctGroups.join(', ')}`;
    }

    // Determine effective role
    let effectiveRole: Role = r.role;
    if (r.isSuperAdmin) {
      effectiveRole = 'super_admin';
    } else if (bNames.length > 0) {
      effectiveRole = 'batch_admin';
    } else if (pDetails.length > 0) {
      effectiveRole = 'pace_admin';
    } else {
      effectiveRole = 'member';
    }

    return {
      id: r.id,
      authUserId: r.authUserId,
      name:
        r.userName ||
        [r.firstName, r.fatherName].filter(Boolean).join(' ') ||
        'Unknown',
      email: r.email,
      telegramUsername: r.telegramUsername,
      telegramLinked: Boolean(
        r.telegramUsername && r.telegramUsername.trim().length > 0,
      ),
      role: effectiveRole,
      isSuperAdmin: r.isSuperAdmin,
      scopeSummary: {
        isSuperAdmin: r.isSuperAdmin,
        batchNames: bNames,
        paceGroupDetails: pDetails,
        summaryText,
      },
      createdAt: r.createdAt,
    };
  });

  return {
    users,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Returns comprehensive details for a single user: profile, admin scopes,
 * batch and pace group memberships, and role change audit history.
 */
export async function getUserDetails(
  profileId: string,
): Promise<UserDetails | null> {
  const [profileRow] = await db
    .select({
      id: profiles.id,
      authUserId: profiles.authUserId,
      firstName: profiles.firstName,
      fatherName: profiles.fatherName,
      grandfatherName: profiles.grandfatherName,
      userName: user.name,
      email: user.email,
      phone: profiles.phone,
      telegramUsername: profiles.telegramUsername,
      role: profiles.role,
      isSuperAdmin: profiles.isSuperAdmin,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
    })
    .from(profiles)
    .innerJoin(user, eq(profiles.authUserId, user.id))
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profileRow) return null;

  const [batchGrants, paceGrants, bMemberships, pMemberships, historyRows] =
    await Promise.all([
      // Batches administered
      db
        .select({
          batchId: batches.id,
          batchName: batches.name,
          registrationOpen: batches.registrationOpen,
          startDate: batches.startDate,
        })
        .from(batchAdmins)
        .innerJoin(batches, eq(batchAdmins.batchId, batches.id))
        .where(eq(batchAdmins.profileId, profileId))
        .orderBy(asc(batches.name)),

      // Pace groups administered
      db
        .select({
          id: paceAdminAssignments.id,
          paceGroupId: paceGroups.id,
          paceGroupName: paceGroups.name,
          batchId: batches.id,
          batchName: batches.name,
          duty: paceAdminAssignments.duty,
          assignedBookTitle: books.title,
          notes: paceAdminAssignments.notes,
          createdAt: paceAdminAssignments.createdAt,
        })
        .from(paceAdminAssignments)
        .innerJoin(
          paceGroups,
          eq(paceAdminAssignments.paceGroupId, paceGroups.id),
        )
        .innerJoin(batches, eq(paceGroups.batchId, batches.id))
        .leftJoin(books, eq(paceAdminAssignments.assignedBookId, books.id))
        .where(eq(paceAdminAssignments.profileId, profileId))
        .orderBy(asc(paceGroups.name), asc(paceAdminAssignments.duty)),

      // Batch memberships
      db
        .select({
          id: batchMemberships.id,
          batchId: batches.id,
          batchName: batches.name,
          status: batchMemberships.status,
          enrolledAt: batchMemberships.createdAt,
        })
        .from(batchMemberships)
        .innerJoin(batches, eq(batchMemberships.batchId, batches.id))
        .where(eq(batchMemberships.profileId, profileId))
        .orderBy(desc(batchMemberships.createdAt)),

      // Pace group memberships
      db
        .select({
          id: paceGroupMemberships.id,
          paceGroupId: paceGroups.id,
          paceGroupName: paceGroups.name,
          batchName: batches.name,
          status: paceGroupMemberships.status,
        })
        .from(paceGroupMemberships)
        .innerJoin(
          paceGroups,
          eq(paceGroupMemberships.paceGroupId, paceGroups.id),
        )
        .innerJoin(batches, eq(paceGroups.batchId, batches.id))
        .where(eq(paceGroupMemberships.profileId, profileId)),

      // Role change history
      db
        .select({
          id: roleAuditLogs.id,
          previousRole: roleAuditLogs.previousRole,
          newRole: roleAuditLogs.newRole,
          previousIsSuperAdmin: roleAuditLogs.previousIsSuperAdmin,
          newIsSuperAdmin: roleAuditLogs.newIsSuperAdmin,
          assignmentChanges: roleAuditLogs.assignmentChanges,
          reason: roleAuditLogs.reason,
          createdAt: roleAuditLogs.createdAt,
          actorFirstName: profiles.firstName,
          actorFatherName: profiles.fatherName,
          actorUserName: user.name,
          actorEmail: user.email,
        })
        .from(roleAuditLogs)
        .leftJoin(profiles, eq(roleAuditLogs.actorProfileId, profiles.id))
        .leftJoin(user, eq(profiles.authUserId, user.id))
        .where(eq(roleAuditLogs.targetProfileId, profileId))
        .orderBy(desc(roleAuditLogs.createdAt))
        .limit(20),
    ]);

  const bNames = batchGrants.map((b) => b.batchName);
  const pDetails = paceGrants.map((p) => ({
    groupName: p.paceGroupName,
    duty: p.duty,
  }));

  let summaryText = 'Member';
  if (profileRow.isSuperAdmin) {
    summaryText = 'Super Admin (Global)';
  } else if (bNames.length > 0 && pDetails.length > 0) {
    summaryText = `Batch Admin (${bNames.join(', ')}) · Pace Admin (${pDetails.map((p) => p.groupName).join(', ')})`;
  } else if (bNames.length > 0) {
    summaryText = `Batch Admin: ${bNames.join(', ')}`;
  } else if (pDetails.length > 0) {
    const distinctGroups = Array.from(
      new Set(pDetails.map((p) => p.groupName)),
    );
    summaryText = `Pace Admin: ${distinctGroups.join(', ')}`;
  }

  return {
    profile: {
      ...profileRow,
      name:
        profileRow.userName ||
        [profileRow.firstName, profileRow.fatherName]
          .filter(Boolean)
          .join(' ') ||
        'Unknown',
      telegramLinked: Boolean(
        profileRow.telegramUsername &&
        profileRow.telegramUsername.trim().length > 0,
      ),
    },
    scopeSummary: {
      isSuperAdmin: profileRow.isSuperAdmin,
      batchNames: bNames,
      paceGroupDetails: pDetails,
      summaryText,
    },
    batchAdminAssignments: batchGrants,
    paceAdminAssignments: paceGrants,
    memberships: {
      batchMemberships: bMemberships,
      paceGroupMemberships: pMemberships,
    },
    roleHistory: historyRows.map((h) => ({
      id: h.id,
      previousRole: h.previousRole,
      newRole: h.newRole,
      previousIsSuperAdmin: h.previousIsSuperAdmin,
      newIsSuperAdmin: h.newIsSuperAdmin,
      actorName:
        h.actorUserName ||
        [h.actorFirstName, h.actorFatherName].filter(Boolean).join(' ') ||
        'System Admin',
      actorEmail: h.actorEmail,
      assignmentChanges: h.assignmentChanges,
      reason: h.reason,
      createdAt: h.createdAt,
    })),
  };
}

/**
 * Safely executes a role and scope change inside a single database transaction.
 * Enforces:
 * - Demotion of the last Super Admin is blocked.
 * - Self-demotion of the actor is blocked.
 * - Removal of the last Batch Admin of any batch is blocked (D1-2 rule).
 * - Automatic cleanup of invalid assignments when roles change.
 * - Transactional audit log generation.
 */
export async function changeUserRole(
  actorProfileId: string,
  input: ChangeUserRoleInput,
): Promise<{ success: boolean; auditId: string }> {
  const { targetProfileId, newRole, batchIds, paceAssignments, reason } = input;

  return db.transaction(async (tx) => {
    // 1. Fetch current target state
    const [target] = await tx
      .select({
        id: profiles.id,
        role: profiles.role,
        isSuperAdmin: profiles.isSuperAdmin,
      })
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .limit(1);

    if (!target) {
      throw new UserManagementError(
        'PROFILE_NOT_FOUND',
        'Target user profile not found.',
      );
    }

    // 2. Prevent self-demotion from super admin
    const newIsSuperAdmin = newRole === 'super_admin';
    if (
      targetProfileId === actorProfileId &&
      target.isSuperAdmin &&
      !newIsSuperAdmin
    ) {
      throw new UserManagementError(
        'SELF_DEMOTION',
        'You cannot remove your own global super admin access.',
      );
    }

    // 3. Prevent demotion of the last Super Admin
    if (target.isSuperAdmin && !newIsSuperAdmin) {
      const [superAdminCount] = await tx
        .select({ count: count() })
        .from(profiles)
        .where(eq(profiles.isSuperAdmin, true));

      if (Number(superAdminCount?.count ?? 0) <= 1) {
        throw new UserManagementError(
          'LAST_SUPER_ADMIN',
          'At least one global super admin must remain.',
        );
      }
    }

    // 4. Fetch current batch assignments of target
    const currentBatchAssignments = await tx
      .select({
        batchId: batchAdmins.batchId,
        batchName: batches.name,
      })
      .from(batchAdmins)
      .innerJoin(batches, eq(batchAdmins.batchId, batches.id))
      .where(eq(batchAdmins.profileId, targetProfileId));

    // 5. Fetch current pace assignments of target
    const currentPaceAssignments = await tx
      .select({
        id: paceAdminAssignments.id,
        paceGroupId: paceAdminAssignments.paceGroupId,
        paceGroupName: paceGroups.name,
        duty: paceAdminAssignments.duty,
      })
      .from(paceAdminAssignments)
      .innerJoin(
        paceGroups,
        eq(paceAdminAssignments.paceGroupId, paceGroups.id),
      )
      .where(eq(paceAdminAssignments.profileId, targetProfileId));

    // 6. Check D1-2 rule: Prevent removal of the last Batch Admin of any batch
    const newBatchIdSet = new Set(newRole === 'batch_admin' ? batchIds : []);
    const removedBatches = currentBatchAssignments.filter(
      (b) => !newBatchIdSet.has(b.batchId),
    );

    for (const removed of removedBatches) {
      const [batchAdminCount] = await tx
        .select({ count: count() })
        .from(batchAdmins)
        .where(eq(batchAdmins.batchId, removed.batchId));

      if (Number(batchAdminCount?.count ?? 0) <= 1) {
        throw new UserManagementError(
          'LAST_BATCH_ADMIN',
          `Cannot remove the last Batch Admin from batch "${removed.batchName}". Another Batch Admin must be assigned before removing this user.`,
        );
      }
    }

    // 7. Track assignment changes for audit
    const assignmentChanges: RoleAssignmentChange = {};

    // 8. Apply Role & Scope Updates
    const now = new Date();

    // Update profiles table
    await tx
      .update(profiles)
      .set({
        role: newRole,
        isSuperAdmin: newIsSuperAdmin,
        updatedAt: now,
      })
      .where(eq(profiles.id, targetProfileId));

    // Update batch assignments
    if (newRole === 'batch_admin') {
      const currentBatchIdSet = new Set(
        currentBatchAssignments.map((b) => b.batchId),
      );

      // Batches to add
      const toAdd = batchIds.filter((id) => !currentBatchIdSet.has(id));
      if (toAdd.length > 0) {
        for (const batchId of toAdd) {
          await tx
            .insert(batchAdmins)
            .values({ profileId: targetProfileId, batchId })
            .onConflictDoNothing();
        }

        const addedBatches = await tx
          .select({ id: batches.id, name: batches.name })
          .from(batches)
          .where(inArray(batches.id, toAdd));

        assignmentChanges.batchesAdded = addedBatches.map((b) => ({
          id: b.id,
          name: b.name,
        }));
      }

      // Batches to remove
      if (removedBatches.length > 0) {
        await tx.delete(batchAdmins).where(
          and(
            eq(batchAdmins.profileId, targetProfileId),
            inArray(
              batchAdmins.batchId,
              removedBatches.map((b) => b.batchId),
            ),
          ),
        );
        assignmentChanges.batchesRemoved = removedBatches.map((b) => ({
          id: b.batchId,
          name: b.batchName,
        }));
      }

      // Remove pace assignments if transitioning from pace_admin to batch_admin
      if (currentPaceAssignments.length > 0) {
        await tx
          .delete(paceAdminAssignments)
          .where(eq(paceAdminAssignments.profileId, targetProfileId));

        assignmentChanges.paceGroupsRemoved = currentPaceAssignments.map(
          (p) => ({
            id: p.paceGroupId,
            name: p.paceGroupName,
            duty: p.duty,
          }),
        );
      }
    } else if (newRole === 'pace_admin') {
      // Remove all batch assignments
      if (currentBatchAssignments.length > 0) {
        await tx
          .delete(batchAdmins)
          .where(eq(batchAdmins.profileId, targetProfileId));

        assignmentChanges.batchesRemoved = currentBatchAssignments.map((b) => ({
          id: b.batchId,
          name: b.batchName,
        }));
      }

      // Pace group assignments
      const currentPaceKeys = new Set(
        currentPaceAssignments.map((p) => `${p.paceGroupId}:${p.duty}`),
      );
      const newPaceKeys = new Set(
        paceAssignments.map((p) => `${p.paceGroupId}:${p.duty}`),
      );

      // Add new assignments
      const toAdd = paceAssignments.filter(
        (p) => !currentPaceKeys.has(`${p.paceGroupId}:${p.duty}`),
      );
      if (toAdd.length > 0) {
        for (const item of toAdd) {
          await tx
            .insert(paceAdminAssignments)
            .values({
              profileId: targetProfileId,
              paceGroupId: item.paceGroupId,
              duty: item.duty,
              assignedBy: actorProfileId,
            })
            .onConflictDoNothing();
        }

        const groupIds = Array.from(new Set(toAdd.map((p) => p.paceGroupId)));
        const groups = await tx
          .select({ id: paceGroups.id, name: paceGroups.name })
          .from(paceGroups)
          .where(inArray(paceGroups.id, groupIds));
        const groupMap = new Map(groups.map((g) => [g.id, g.name]));

        assignmentChanges.paceGroupsAdded = toAdd.map((item) => ({
          id: item.paceGroupId,
          name: groupMap.get(item.paceGroupId) ?? 'Pace Group',
          duty: item.duty,
        }));
      }

      // Remove old assignments
      const toRemove = currentPaceAssignments.filter(
        (p) => !newPaceKeys.has(`${p.paceGroupId}:${p.duty}`),
      );
      if (toRemove.length > 0) {
        await tx.delete(paceAdminAssignments).where(
          and(
            eq(paceAdminAssignments.profileId, targetProfileId),
            inArray(
              paceAdminAssignments.id,
              toRemove.map((p) => p.id),
            ),
          ),
        );
        assignmentChanges.paceGroupsRemoved = toRemove.map((p) => ({
          id: p.paceGroupId,
          name: p.paceGroupName,
          duty: p.duty,
        }));
      }
    } else if (newRole === 'member') {
      // Demote to member: clean up all batch and pace admin assignments
      if (currentBatchAssignments.length > 0) {
        await tx
          .delete(batchAdmins)
          .where(eq(batchAdmins.profileId, targetProfileId));

        assignmentChanges.batchesRemoved = currentBatchAssignments.map((b) => ({
          id: b.batchId,
          name: b.batchName,
        }));
      }

      if (currentPaceAssignments.length > 0) {
        await tx
          .delete(paceAdminAssignments)
          .where(eq(paceAdminAssignments.profileId, targetProfileId));

        assignmentChanges.paceGroupsRemoved = currentPaceAssignments.map(
          (p) => ({
            id: p.paceGroupId,
            name: p.paceGroupName,
            duty: p.duty,
          }),
        );
      }
    } else if (newRole === 'super_admin') {
      // Super admin retains existing assignments or can clear them. Per rules, super admin is a superset.
      // We don't remove existing assignments unless explicitly desired, but keep records accurate.
    }

    // 9. Write Audit Record in the same transaction
    const [auditLog] = await tx
      .insert(roleAuditLogs)
      .values({
        targetProfileId,
        actorProfileId,
        previousRole: target.role,
        newRole,
        previousIsSuperAdmin: target.isSuperAdmin,
        newIsSuperAdmin,
        assignmentChanges:
          Object.keys(assignmentChanges).length > 0 ? assignmentChanges : null,
        reason: reason || null,
        createdAt: now,
      })
      .returning({ id: roleAuditLogs.id });

    if (!auditLog) {
      throw new UserManagementError(
        'TRANSACTION_FAILED',
        'Failed to record role change audit log.',
      );
    }

    return {
      success: true,
      auditId: auditLog.id,
    };
  });
}
