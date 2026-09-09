import "server-only";

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  applications,
  batchAdmins,
  batchMemberships,
  batches,
  books,
  paceGroupAdmins,
  paceGroupMemberships,
  paceGroups,
  profiles,
  user,
} from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/session";

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

export type BatchReadiness = {
  catalog_ready: boolean;
  batch_admins_assigned: boolean;
  pace_groups_ready: boolean;
  pace_admins_assigned: boolean;
  pacing_confirmed: boolean;
  registration_open: boolean;
  score: number;
  total: 6;
  isReady: boolean;
  details: {
    catalogBooksCount: number;
    assignedBatchAdminCount: number;
    plannedPaceGroupCount: number;
    actualPaceGroupCount: number;
    paceGroupsWithoutAdminCount: number;
    startDate: string | null;
    readingDaysPerWeek: number;
    registrationOpen: boolean;
    paceGroupPaces: number[];
  };
};

export type AdminBatchWithReadiness = AdminBatch & {
  readiness: BatchReadiness;
  actualPaceGroupCount: number;
};

export type PaginatedBatchesResult = {
  batches: AdminBatchWithReadiness[];
  pagination: {
    page: number;
    pageSize: number;
    totalBatches: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
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

/**
 * Computes the 6-boolean readiness record for a single batch given aggregated data.
 * Exported for direct unit testing — no DB access here.
 */
export function computeReadiness({
  catalogBooksCount,
  assignedBatchAdminCount,
  plannedPaceGroupCount,
  actualPaceGroupCount,
  paceGroupsWithoutAdminCount,
  startDate,
  readingDaysPerWeek,
  registrationOpen,
  paceGroupPaces,
}: BatchReadiness["details"]): BatchReadiness {
  const catalog_ready = catalogBooksCount > 0;
  const batch_admins_assigned =
    assignedBatchAdminCount >= 1 && assignedBatchAdminCount <= 3;
  const pace_groups_ready = actualPaceGroupCount === plannedPaceGroupCount;
  const pace_admins_assigned =
    actualPaceGroupCount > 0 && paceGroupsWithoutAdminCount === 0;
  const pacing_confirmed =
    startDate !== null &&
    readingDaysPerWeek > 0 &&
    actualPaceGroupCount > 0 &&
    paceGroupPaces.length > 0 &&
    paceGroupPaces.every((p) => p > 0);
  const registration_open = registrationOpen;

  const flags = [
    catalog_ready,
    batch_admins_assigned,
    pace_groups_ready,
    pace_admins_assigned,
    pacing_confirmed,
    registration_open,
  ];
  const score = flags.filter(Boolean).length;

  return {
    catalog_ready,
    batch_admins_assigned,
    pace_groups_ready,
    pace_admins_assigned,
    pacing_confirmed,
    registration_open,
    score,
    total: 6,
    isReady: score === 6,
    details: {
      catalogBooksCount,
      assignedBatchAdminCount,
      plannedPaceGroupCount,
      actualPaceGroupCount,
      paceGroupsWithoutAdminCount,
      startDate,
      readingDaysPerWeek,
      registrationOpen,
      paceGroupPaces,
    },
  };
}

/**
 * Paginated batch listing with per-batch readiness aggregation.
 * - super_admin: sees all batches.
 * - batch_admin: sees only assigned batches.
 * - other roles: throws AuthzError FORBIDDEN.
 */
export async function getAdminBatchesPaginated({
  user: currentUser,
  page = 1,
  pageSize = 20,
}: {
  user: CurrentUser;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedBatchesResult> {
  const { AuthzError } = await import("@/lib/auth/authorize");

  const role = currentUser.profile.role;
  if (role !== "super_admin" && role !== "batch_admin") {
    throw new AuthzError(
      "FORBIDDEN",
      `Role '${role}' is not permitted to access batch administration.`,
    );
  }

  // ── Resolve batch-admin scope ──────────────────────────────────────────────
  let assignedBatchIds: string[] | null = null;
  if (role === "batch_admin") {
    const assignments = await db
      .select({ batchId: batchAdmins.batchId })
      .from(batchAdmins)
      .where(eq(batchAdmins.profileId, currentUser.profile.id));
    assignedBatchIds = assignments.map((r) => r.batchId);
  }

  // ── Total count for pagination ─────────────────────────────────────────────
  const totalCountQuery = db
    .select({ count: count(batches.id) })
    .from(batches);
  if (assignedBatchIds !== null) {
    if (assignedBatchIds.length === 0) {
      // batch_admin with zero assignments — return empty result immediately.
      return {
        batches: [],
        pagination: {
          page,
          pageSize,
          totalBatches: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }
    totalCountQuery.where(inArray(batches.id, assignedBatchIds));
  }
  const [totalRow] = await totalCountQuery;
  const totalBatches = Number(totalRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalBatches / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // ── Fetch paginated batch rows ─────────────────────────────────────────────
  const batchQuery = db
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
    .orderBy(desc(batches.startDate), asc(batches.name))
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);

  if (assignedBatchIds !== null) {
    batchQuery.where(inArray(batches.id, assignedBatchIds));
  }

  const batchRows = await batchQuery;
  const pageIds = batchRows.map((r) => r.id);

  if (pageIds.length === 0) {
    return {
      batches: [],
      pagination: {
        page: safePage,
        pageSize,
        totalBatches,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  }

  // ── Batch admins for this page ─────────────────────────────────────────────
  const adminRows = await db
    .select({
      batchId: batchAdmins.batchId,
      name: sql<string>`coalesce(${user.name}, concat(${profiles.firstName}, ' ', ${profiles.fatherName}))`,
    })
    .from(batchAdmins)
    .innerJoin(profiles, eq(profiles.id, batchAdmins.profileId))
    .innerJoin(user, eq(user.id, profiles.authUserId))
    .where(inArray(batchAdmins.batchId, pageIds));

  const adminsByBatch = new Map<string, string[]>();
  const adminCountByBatch = new Map<string, number>();
  for (const row of adminRows) {
    const names = adminsByBatch.get(row.batchId) ?? [];
    names.push(row.name);
    adminsByBatch.set(row.batchId, names);
    adminCountByBatch.set(row.batchId, names.length);
  }

  // ── Pace groups + pace admin counts for this page ─────────────────────────
  const paceGroupRows = await db
    .select({
      id: paceGroups.id,
      batchId: paceGroups.batchId,
      size: paceGroups.size,
      adminCount: count(paceGroupAdmins.profileId),
    })
    .from(paceGroups)
    .leftJoin(
      paceGroupAdmins,
      eq(paceGroupAdmins.paceGroupId, paceGroups.id),
    )
    .where(inArray(paceGroups.batchId, pageIds))
    .groupBy(paceGroups.id, paceGroups.batchId, paceGroups.size);

  type PGInfo = { size: number; adminCount: number };
  const paceGroupsByBatch = new Map<string, PGInfo[]>();
  for (const row of paceGroupRows) {
    const groups = paceGroupsByBatch.get(row.batchId) ?? [];
    groups.push({ size: row.size, adminCount: Number(row.adminCount) });
    paceGroupsByBatch.set(row.batchId, groups);
  }

  // ── Global catalog count (shared across all batches) ──────────────────────
  const [catalogRow] = await db.select({ count: count(books.id) }).from(books);
  const catalogBooksCount = Number(catalogRow?.count ?? 0);

  // ── Assemble result ────────────────────────────────────────────────────────
  const enriched: AdminBatchWithReadiness[] = batchRows.map((row) => {
    const groups = paceGroupsByBatch.get(row.id) ?? [];
    const actualPaceGroupCount = groups.length;
    const paceGroupsWithoutAdminCount = groups.filter(
      (g) => g.adminCount === 0,
    ).length;
    const paceGroupPaces = groups.map((g) => g.size);
    const assignedBatchAdminCount = adminCountByBatch.get(row.id) ?? 0;

    const details: BatchReadiness["details"] = {
      catalogBooksCount,
      assignedBatchAdminCount,
      plannedPaceGroupCount: row.paceGroupCount,
      actualPaceGroupCount,
      paceGroupsWithoutAdminCount,
      startDate: row.startDate,
      readingDaysPerWeek: row.readingDaysPerWeek,
      registrationOpen: row.registrationOpen,
      paceGroupPaces,
    };

    return {
      id: row.id,
      name: row.name,
      maxMembers: row.maxMembers,
      enrolled: Number(row.enrolled),
      paceGroupCount: row.paceGroupCount,
      startDate: row.startDate,
      readingDaysPerWeek: row.readingDaysPerWeek,
      registrationOpen: row.registrationOpen,
      admins: adminsByBatch.get(row.id) ?? [],
      actualPaceGroupCount,
      readiness: computeReadiness(details),
    };
  });

  return {
    batches: enriched,
    pagination: {
      page: safePage,
      pageSize,
      totalBatches,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    },
  };
}

export async function getAdminApplications(): Promise<AdminApplication[]> {
  const rows = await db
    .select({
      id: applications.id,
      name: applications.registrationName,
      email: applications.email,
      batch: batches.name,
      batchId: applications.batchId,
      appliedOn: applications.createdAt,
      telegramUsername: applications.telegramUsername,
      profileId: applications.userId,
      membershipId: batchMemberships.id,
      membershipStatus: batchMemberships.status,
    })
    .from(applications)
    .innerJoin(batches, eq(batches.id, applications.batchId))
    .leftJoin(
      batchMemberships,
      and(
        eq(batchMemberships.profileId, applications.userId),
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
  const [catalogCount] = await db
    .select({ count: count(books.id) })
    .from(books);

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
  };
}
