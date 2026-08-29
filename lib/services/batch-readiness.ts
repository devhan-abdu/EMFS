import { eq, sql, count, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  batches,
  batchAdmins,
  paceGroups,
  paceGroupAdmins,
  books,
} from "@/db/schema";
import type { DbOrTx } from "@/lib/services/batch";

export type BatchReadinessStatus = {
  batchId: string;
  batchName: string;
  catalogReady: boolean;
  batchAdminsAssigned: boolean;
  paceGroupsReady: boolean;
  paceAdminsAssigned: boolean;
  pacingConfirmed: boolean;
  registrationOpen: boolean;
};

export type PaginatedReadinessResult = {
  items: BatchReadinessStatus[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Checks whether the shared book catalog has at least 1 book.
 * The books table has no batch_id — it is a global catalog.
 */
export async function isCatalogReady(
  executor: DbOrTx = db
): Promise<boolean> {
  const [result] = await executor
    .select({ bookCount: count() })
    .from(books);
  return (result?.bookCount ?? 0) > 0;
}

/**
 * Returns the count of assigned batch admins for a given batch.
 */
export async function getBatchAdminCount(
  batchId: string,
  executor: DbOrTx = db
): Promise<number> {
  const [result] = await executor
    .select({ adminCount: count() })
    .from(batchAdmins)
    .where(eq(batchAdmins.batchId, batchId));
  return result?.adminCount ?? 0;
}

/**
 * Returns the actual pace group count for a given batch.
 */
export async function getActualPaceGroupCount(
  batchId: string,
  executor: DbOrTx = db
): Promise<number> {
  const [result] = await executor
    .select({ groupCount: count() })
    .from(paceGroups)
    .where(eq(paceGroups.batchId, batchId));
  return result?.groupCount ?? 0;
}

/**
 * Checks whether every pace group in a batch has at least 1 admin assigned.
 * Returns false if the batch has no pace groups.
 */
export async function arePaceAdminsAssigned(
  batchId: string,
  executor: DbOrTx = db
): Promise<boolean> {
  // Get all pace group IDs for this batch
  const batchPaceGroups = await executor
    .select({ id: paceGroups.id })
    .from(paceGroups)
    .where(eq(paceGroups.batchId, batchId));

  if (batchPaceGroups.length === 0) {
    return false;
  }

  const paceGroupIds = batchPaceGroups.map((pg) => pg.id);

  // Count distinct pace groups that have at least one admin
  const groupsWithAdmins = await executor
    .select({
      coveredGroups: sql<number>`COUNT(DISTINCT ${paceGroupAdmins.paceGroupId})`,
    })
    .from(paceGroupAdmins)
    .where(inArray(paceGroupAdmins.paceGroupId, paceGroupIds));

  const coveredCount = groupsWithAdmins[0]?.coveredGroups ?? 0;
  return coveredCount === batchPaceGroups.length;
}

/**
 * Computes the readiness status for a single batch.
 */
export async function computeBatchReadiness(
  batch: {
    id: string;
    name: string;
    paceGroupCount: number;
    startDate: string | null;
    readingDaysPerWeek: number | null;
    registrationOpen: boolean;
  },
  catalogReady: boolean,
  executor: DbOrTx = db
): Promise<BatchReadinessStatus> {
  const adminCount = await getBatchAdminCount(batch.id, executor);
  const actualPaceGroupCount = await getActualPaceGroupCount(batch.id, executor);
  const paceAdminsOk = await arePaceAdminsAssigned(batch.id, executor);

  return {
    batchId: batch.id,
    batchName: batch.name,
    catalogReady,
    batchAdminsAssigned: adminCount >= 1 && adminCount <= 3,
    paceGroupsReady: actualPaceGroupCount === batch.paceGroupCount,
    paceAdminsAssigned: paceAdminsOk,
    pacingConfirmed: batch.startDate !== null && batch.readingDaysPerWeek !== null,
    registrationOpen: batch.registrationOpen,
  };
}

/**
 * Returns paginated batch readiness statuses.
 *
 * @param page - 1-indexed page number
 * @param pageSize - number of items per page (default 20)
 * @param filterBatchIds - optional array of batch IDs to restrict to (for batch_admin role filtering)
 */
export async function getBatchReadinessStatuses(
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  filterBatchIds?: string[],
  executor: DbOrTx = db
): Promise<PaginatedReadinessResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const offset = (safePage - 1) * safePageSize;

  // Build where clause for optional batch_admin filtering
  const whereClause = filterBatchIds
    ? inArray(batches.id, filterBatchIds)
    : undefined;

  // Get total count
  const [countResult] = await executor
    .select({ total: count() })
    .from(batches)
    .where(whereClause);
  const total = countResult?.total ?? 0;

  // Get paginated batch records
  const batchRows = await executor
    .select()
    .from(batches)
    .where(whereClause)
    .orderBy(batches.createdAt)
    .limit(safePageSize)
    .offset(offset);

  // Compute catalog readiness once (global check)
  const catalogReady = await isCatalogReady(executor);

  // Compute readiness for each batch
  const items: BatchReadinessStatus[] = [];
  for (const batch of batchRows) {
    const status = await computeBatchReadiness(
      {
        id: batch.id,
        name: batch.name,
        paceGroupCount: batch.paceGroupCount,
        startDate: batch.startDate,
        readingDaysPerWeek: batch.readingDaysPerWeek,
        registrationOpen: batch.registrationOpen,
      },
      catalogReady,
      executor
    );
    items.push(status);
  }

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
  };
}

/**
 * Gets batch IDs assigned to a specific admin profile (for role-based filtering).
 */
export async function getAdminBatchIds(
  profileId: string,
  executor: DbOrTx = db
): Promise<string[]> {
  const records = await executor
    .select({ batchId: batchAdmins.batchId })
    .from(batchAdmins)
    .where(eq(batchAdmins.profileId, profileId));

  return records.map((r) => r.batchId);
}
