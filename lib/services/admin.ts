import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { db } from '@/db';
import {
  applications,
  batchAdmins,
  batchMemberships,
  batches,
  books,
  catalogSlots,
  paceAdminAssignments,
  paceGroupMemberships,
  paceGroups,
  profiles,
  user,
} from '@/db/schema';
import type { CurrentUser } from '@/lib/auth/session';
import {
  getAuthorizedBatchIds,
  getAuthorizedPaceGroupIds,
} from '@/lib/auth/authorize';

const ADMIN_OVERVIEW_RECENT_BOOK_LIMIT = 5;

export type AdminCatalogBook = {
  id: string;
  title: string;
  language: string;
  sequenceOrder: number;
  createdAt: Date;
};

export type AdminCatalogEditionGap = {
  sequenceOrder: number;
  editionCount: number;
};

export type AdminCatalogCurriculumGap = {
  id: string;
  title: string;
  language: string;
  sequenceOrder: number;
  tasksCount: number;
};

export type AdminBatch = {
  id: string;
  name: string;
  maxMembers: number;
  enrolled: number;
  paceGroupCount: number;
  startDate: string | null;
  readingDaysPerWeek: number;
  registrationOpen: boolean;
  createdAt: Date;
  admins: string[];
};

export type AdminApplication = {
  id: string;
  profileId: string;
  batchId: string;
  membershipId: string | null;
  name: string;
  email: string;
  batch: string;
  appliedOn: string;
  status: 'pending' | 'approved' | 'handoff' | 'rejected';
  telegramLinked: boolean;
};

export type AdminPaceGroup = {
  id: string;
  name: string;
  batch: string;
  members: number;
  createdAt: Date;
  admin: string;
  currentBook: string;
  dayProgress: number;
  totalDays: number;
};

export type AdminStaffMember = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  batchAssignments: { id: string; name: string }[];
  paceGroupAssignments: {
    id: string;
    name: string;
    batchId: string;
    batchName: string;
  }[];
  lastActive: string;
};

function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString().slice(0, 10) : date;
}

export async function getAdminBatches(
  userContext?: CurrentUser,
): Promise<AdminBatch[]> {
  const batchConditions: SQL[] = [];
  if (userContext) {
    const authBatchIds = await getAuthorizedBatchIds(userContext);
    if (authBatchIds !== 'all') {
      if (authBatchIds.length === 0) {
        return [];
      }
      batchConditions.push(inArray(batches.id, authBatchIds));
    }
  }

  const query = db
    .select({
      id: batches.id,
      name: batches.name,
      maxMembers: batches.maxMembers,
      paceGroupCount: batches.paceGroupCount,
      startDate: batches.startDate,
      readingDaysPerWeek: batches.readingDaysPerWeek,
      registrationOpen: batches.registrationOpen,
      createdAt: batches.createdAt,
      enrolled: count(batchMemberships.id),
    })
    .from(batches)
    .leftJoin(
      batchMemberships,
      and(
        eq(batchMemberships.batchId, batches.id),
        eq(batchMemberships.status, 'active'),
      ),
    );

  const rows = await (batchConditions.length > 0
    ? query.where(and(...batchConditions)).groupBy(batches.id)
    : query.groupBy(batches.id));

  const adminRows = await db
    .select({
      batchId: batchAdmins.batchId,
      name: sql<string>`coalesce(${user.name}, concat(${profiles.firstName}, ' ', ${profiles.fatherName}))`,
    })
    .from(batchAdmins)
    .innerJoin(profiles, eq(profiles.id, batchAdmins.profileId))
    .innerJoin(user, eq(user.id, profiles.authUserId));

  const adminsByBatch = new Map<string, string[]>();
  for (const row of adminRows) {
    const names = adminsByBatch.get(row.batchId) ?? [];
    names.push(row.name);
    adminsByBatch.set(row.batchId, names);
  }

  return rows.map((row) => ({
    ...row,
    enrolled: Number(row.enrolled),
    startDate: row.startDate,
    admins: adminsByBatch.get(row.id) ?? [],
  }));
}

export async function getAdminApplications(
  userContext?: CurrentUser,
): Promise<AdminApplication[]> {
  const appConditions: SQL[] = [];
  if (userContext) {
    const authBatchIds = await getAuthorizedBatchIds(userContext);
    if (authBatchIds !== 'all') {
      if (authBatchIds.length === 0) return [];
      appConditions.push(inArray(applications.batchId, authBatchIds));
    }
  }

  const query = db
    .select({
      id: applications.id,
      name: applications.firstName,
      email: applications.email,
      batch: batches.name,
      batchId: applications.batchId,
      appliedOn: applications.createdAt,
      telegramUsername: applications.telegramUsername,
      profileId: applications.profileId,
      membershipId: batchMemberships.id,
      membershipStatus: batchMemberships.status,
    })
    .from(applications)
    .innerJoin(batches, eq(batches.id, applications.batchId))
    .leftJoin(
      batchMemberships,
      and(
        eq(batchMemberships.profileId, applications.profileId),
        eq(batchMemberships.batchId, applications.batchId),
      ),
    );

  const rows = await (appConditions.length > 0
    ? query.where(and(...appConditions)).orderBy(desc(applications.createdAt))
    : query.orderBy(desc(applications.createdAt)));

  return rows.map((row) => {
    const membershipStatus = row.membershipStatus;
    const status =
      membershipStatus === 'rejected'
        ? 'rejected'
        : membershipStatus === 'approved' || membershipStatus === 'active'
          ? row.telegramUsername
            ? 'handoff'
            : 'approved'
          : 'pending';

    return {
      id: row.id,
      profileId: row.profileId,
      batchId: row.batchId,
      membershipId: row.membershipId,
      name: row.name,
      email: row.email,
      batch: row.batch,
      appliedOn: formatDate(row.appliedOn) ?? '',
      status,
      telegramLinked: Boolean(row.telegramUsername),
    };
  });
}

export async function getAdminPaceGroups(
  userContext?: CurrentUser,
): Promise<AdminPaceGroup[]> {
  const groupConditions: SQL[] = [eq(paceGroups.archived, false)];
  if (userContext) {
    const authGroupIds = await getAuthorizedPaceGroupIds(userContext);
    if (authGroupIds !== 'all') {
      if (authGroupIds.length === 0) return [];
      groupConditions.push(inArray(paceGroups.id, authGroupIds));
    }
  }

  const query = db
    .select({
      id: paceGroups.id,
      name: paceGroups.name,
      batch: batches.name,
      members: count(paceGroupMemberships.id),
      createdAt: paceGroups.createdAt,
    })
    .from(paceGroups)
    .innerJoin(batches, eq(batches.id, paceGroups.batchId))
    .leftJoin(
      paceGroupMemberships,
      and(
        eq(paceGroupMemberships.paceGroupId, paceGroups.id),
        eq(paceGroupMemberships.status, 'active'),
      ),
    );

  const rows = await query
    .where(and(...groupConditions))
    .groupBy(paceGroups.id, batches.name)
    .orderBy(asc(batches.name), asc(paceGroups.name));

  return rows.map((row) => ({
    ...row,
    members: Number(row.members),
    admin: 'Unassigned',
    currentBook: 'No book assigned',
    dayProgress: 0,
    totalDays: 0,
  }));
}

export async function getAdminStaff(): Promise<AdminStaffMember[]> {
  const rows = await db
    .select({
      id: profiles.id,
      name: sql<string>`coalesce(${user.name}, concat(${profiles.firstName}, ' ', ${profiles.fatherName}))`,
      email: user.email,
      isSuperAdmin: profiles.isSuperAdmin,
      lastActive: profiles.updatedAt,
    })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.authUserId))
    .orderBy(asc(user.name));

  const [batchAssignments, paceAssignments] = await Promise.all([
    db
      .select({
        profileId: batchAdmins.profileId,
        id: batches.id,
        name: batches.name,
      })
      .from(batchAdmins)
      .innerJoin(batches, eq(batches.id, batchAdmins.batchId)),
    db
      .selectDistinct({
        profileId: paceAdminAssignments.profileId,
        id: paceGroups.id,
        name: paceGroups.name,
        batchId: batches.id,
        batchName: batches.name,
      })
      .from(paceAdminAssignments)
      .innerJoin(
        paceGroups,
        eq(paceGroups.id, paceAdminAssignments.paceGroupId),
      )
      .innerJoin(batches, eq(batches.id, paceGroups.batchId)),
  ]);

  return rows.map((row) => ({
    ...row,
    batchAssignments: batchAssignments
      .filter((assignment) => assignment.profileId === row.id)
      .map(({ id, name }) => ({ id, name })),
    paceGroupAssignments: paceAssignments
      .filter((assignment) => assignment.profileId === row.id)
      .map(({ id, name, batchId, batchName }) => ({
        id,
        name,
        batchId,
        batchName,
      })),
    lastActive: formatDate(row.lastActive) ?? 'Unknown',
  }));
}

export async function getAdminOverviewData() {
  const adminBatches = await getAdminBatches();
  const today = new Date().toISOString().slice(0, 10);

  const [memberCount] = await db
    .select({
      count: sql<number>`count(distinct ${batchMemberships.profileId})`,
    })
    .from(batchMemberships)
    .where(inArray(batchMemberships.status, ['active', 'grace']));
  const [
    [catalogBookCount],
    [batchAdminCount],
    recentAdditions,
    recentActiveBatchRows,
  ] = await Promise.all([
    db
      .select({ count: count(books.id) })
      .from(books)
      .innerJoin(catalogSlots, eq(catalogSlots.id, books.catalogSlotId))
      .where(eq(catalogSlots.archived, false)),
    db
      .select({
        count: sql<number>`count(distinct ${batchAdmins.profileId})`,
      })
      .from(batchAdmins)
      .innerJoin(batches, eq(batchAdmins.batchId, batches.id))
      .where(
        or(eq(batches.registrationOpen, true), lte(batches.startDate, today)),
      ),
    db
      .select({
        id: books.id,
        title: books.title,
        language: books.language,
        sequenceOrder: catalogSlots.sequenceOrder,
        createdAt: books.createdAt,
      })
      .from(books)
      .innerJoin(catalogSlots, eq(catalogSlots.id, books.catalogSlotId))
      .where(eq(catalogSlots.archived, false))
      .orderBy(desc(books.createdAt))
      .limit(ADMIN_OVERVIEW_RECENT_BOOK_LIMIT),
    db
      .select({ id: batches.id })
      .from(batches)
      .where(
        or(eq(batches.registrationOpen, true), lte(batches.startDate, today)),
      )
      .orderBy(desc(batches.createdAt))
      .limit(4),
  ]);

  const overviewBatches = adminBatches.map((batch) => {
    const hasStarted = Boolean(batch.startDate && batch.startDate <= today);

    return {
      ...batch,
      lifecycleStatus: batch.registrationOpen
        ? ('registration-open' as const)
        : hasStarted
          ? ('started' as const)
          : ('draft' as const),
      registrationNeedsReview: Boolean(
        batch.startDate && batch.startDate > today && !batch.registrationOpen,
      ),
    };
  });
  const overviewBatchesById = new Map(
    overviewBatches.map((batch) => [batch.id, batch]),
  );
  const recentBatches = recentActiveBatchRows.flatMap(({ id }) => {
    const batch = overviewBatchesById.get(id);
    return batch ? [batch] : [];
  });

  return {
    batches: overviewBatches,
    recentBatches,
    stats: {
      totalReaders: Number(memberCount?.count ?? 0),
      activeBatches: overviewBatches.filter(
        (batch) => batch.lifecycleStatus !== 'draft',
      ).length,
      draftBatches: overviewBatches.filter(
        (batch) => batch.lifecycleStatus === 'draft',
      ).length,
      assignedBatchAdmins: Number(batchAdminCount?.count ?? 0),
      catalogBooks: Number(catalogBookCount?.count ?? 0),
    },
    catalog: {
      recentAdditions,
    },
  };
}
