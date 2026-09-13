import "server-only";

import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { countOrphanedCloudinaryAssets } from "@/lib/services/catalog/cloudinary";
import {
  applications,
  batchAdmins,
  batchMemberships,
  batches,
  books,
  paceGroupMemberships,
  paceGroups,
  profiles,
  tasks,
  user,
} from "@/db/schema";

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
  status: "pending" | "approved" | "handoff" | "rejected";
  telegramLinked: boolean;
};

export type AdminPaceGroup = {
  id: string;
  name: string;
  batch: string;
  members: number;
  admin: string;
  currentBook: string;
  dayProgress: number;
  totalDays: number;
};

export type AdminStaffMember = {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "batch_admin" | "pace_admin" | "member";
  scope: string;
  lastActive: string;
};

function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString().slice(0, 10) : date;
}

export async function getAdminBatches(): Promise<AdminBatch[]> {
  const rows = await db
    .select({
      id: batches.id,
      name: batches.name,
      maxMembers: batches.maxMembers,
      paceGroupCount: batches.paceGroupCount,
      startDate: batches.startDate,
      readingDaysPerWeek: batches.readingDaysPerWeek,
      registrationOpen: batches.registrationOpen,
      enrolled: count(batchMemberships.id),
    })
    .from(batches)
    .leftJoin(
      batchMemberships,
      and(
        eq(batchMemberships.batchId, batches.id),
        eq(batchMemberships.status, "active"),
      ),
    )
    .groupBy(batches.id)
    .orderBy(desc(batches.startDate), asc(batches.name));

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

export async function getAdminApplications(): Promise<AdminApplication[]> {
  const rows = await db
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
    )
    .orderBy(desc(applications.createdAt));

  return rows.map((row) => {
    const membershipStatus = row.membershipStatus;
    const status =
      membershipStatus === "rejected" ? "rejected"
      : membershipStatus === "approved" || membershipStatus === "active" ?
        row.telegramUsername ?
          "handoff"
        : "approved"
      : "pending";

    return {
      id: row.id,
      profileId: row.profileId,
      batchId: row.batchId,
      membershipId: row.membershipId,
      name: row.name,
      email: row.email,
      batch: row.batch,
      appliedOn: formatDate(row.appliedOn) ?? "",
      status,
      telegramLinked: Boolean(row.telegramUsername),
    };
  });
}

export async function getAdminPaceGroups(): Promise<AdminPaceGroup[]> {
  const rows = await db
    .select({
      id: paceGroups.id,
      name: paceGroups.name,
      batch: batches.name,
      members: count(paceGroupMemberships.id),
    })
    .from(paceGroups)
    .innerJoin(batches, eq(batches.id, paceGroups.batchId))
    .leftJoin(
      paceGroupMemberships,
      and(
        eq(paceGroupMemberships.paceGroupId, paceGroups.id),
        eq(paceGroupMemberships.status, "active"),
      ),
    )
    .groupBy(paceGroups.id, batches.name)
    .orderBy(asc(batches.name), asc(paceGroups.name));

  return rows.map((row) => ({
    ...row,
    members: Number(row.members),
    admin: "Unassigned",
    currentBook: "No book assigned",
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
      role: profiles.role,
      lastActive: profiles.updatedAt,
    })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.authUserId))
    .orderBy(asc(user.name));

  return rows.map((row) => ({
    ...row,
    scope: row.role === "super_admin" ? "All batches" : "Assigned batches",
    lastActive: formatDate(row.lastActive) ?? "Unknown",
  }));
}

export async function getAdminOverviewData() {
  const [adminBatches, adminApplications, adminPaceGroups] = await Promise.all([
    getAdminBatches(),
    getAdminApplications(),
    getAdminPaceGroups(),
  ]);

  const [memberCount] = await db
    .select({ count: count(profiles.id) })
    .from(profiles)
    .where(eq(profiles.role, "member"));
  const [
    [catalogCount],
    recentAdditions,
    editionCoverageGaps,
    curriculumGaps,
    referencedCoverRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${books.sequenceOrder})` })
      .from(books),
    db
      .select({
        id: books.id,
        title: books.title,
        language: books.language,
        sequenceOrder: books.sequenceOrder,
        createdAt: books.createdAt,
      })
      .from(books)
      .orderBy(desc(books.createdAt))
      .limit(ADMIN_OVERVIEW_RECENT_BOOK_LIMIT),
    db
      .select({
        sequenceOrder: books.sequenceOrder,
        editionCount: sql<number>`count(distinct ${books.language})`,
      })
      .from(books)
      .groupBy(books.sequenceOrder)
      .having(sql`count(distinct ${books.language}) = 1`)
      .orderBy(asc(books.sequenceOrder)),
    db
      .select({
        id: books.id,
        title: books.title,
        language: books.language,
        sequenceOrder: books.sequenceOrder,
        tasksCount: count(tasks.id),
      })
      .from(books)
      .leftJoin(tasks, eq(tasks.bookId, books.id))
      .groupBy(books.id)
      .having(sql`count(${tasks.id}) = 0`)
      .orderBy(asc(books.sequenceOrder), asc(books.language)),
    db.select({ coverUrl: books.coverUrl }).from(books),
  ]);
  let orphanedUploadCount: number | null = null;
  try {
    orphanedUploadCount = await countOrphanedCloudinaryAssets(
      referencedCoverRows
        .map((row) => row.coverUrl)
        .filter((url): url is string => Boolean(url)),
    );
  } catch {
    // Cloudinary health must not prevent the admin overview from loading.
  }

  return {
    batches: adminBatches,
    applications: adminApplications,
    paceGroups: adminPaceGroups,
    stats: {
      activeMembers: Number(memberCount?.count ?? 0),
      activeBatches: adminBatches.filter((batch) => batch.registrationOpen)
        .length,
      pendingApplications: adminApplications.filter(
        (application) => application.status === "pending",
      ).length,
      catalogSlots: Number(catalogCount?.count ?? 0),
    },
    catalog: {
      recentAdditions,
      editionCoverageGaps: editionCoverageGaps.map((gap) => ({
        ...gap,
        editionCount: Number(gap.editionCount),
      })),
      curriculumGaps: curriculumGaps.map((gap) => ({
        ...gap,
        tasksCount: Number(gap.tasksCount),
      })),
      orphanedUploadCount,
    },
  };
}
