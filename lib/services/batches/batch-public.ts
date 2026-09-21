import { asc, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { batches, batchMemberships } from '@/db/schema';

export type PublicBatchSummary = {
  id: string;
  name: string;
  enrolled: number;
  maxMembers: number;
  startDate: string | null;
  readingDaysPerWeek: number;
  isFull: boolean;
};

export type PublicBatchDetails = PublicBatchSummary;

const enrolledCount = sql<number>`
  count(${batchMemberships.id})
  filter (
    where ${batchMemberships.status} in ('approved', 'active', 'grace')
  )
`;

export async function getOpenBatchesForPublic(): Promise<PublicBatchSummary[]> {
  const rows = await db
    .select({
      id: batches.id,
      name: batches.name,
      maxMembers: batches.maxMembers,
      startDate: batches.startDate,
      readingDaysPerWeek: batches.readingDaysPerWeek,
      enrolled: enrolledCount,
    })
    .from(batches)
    .leftJoin(batchMemberships, eq(batchMemberships.batchId, batches.id))
    .where(eq(batches.registrationOpen, true))
    .groupBy(
      batches.id,
      batches.name,
      batches.maxMembers,
      batches.startDate,
      batches.readingDaysPerWeek,
    )
    .orderBy(desc(batches.createdAt), asc(batches.name));

  return rows.map((row) => {
    const enrolled = Number(row.enrolled ?? 0);

    return {
      id: row.id,
      name: row.name,
      enrolled,
      maxMembers: row.maxMembers,
      startDate: row.startDate,
      readingDaysPerWeek: row.readingDaysPerWeek,
      isFull: enrolled >= row.maxMembers,
    };
  });
}

export async function getBatchDetailsForPublic(
  batchId: string,
): Promise<PublicBatchDetails | null> {
  const rows = await db
    .select({
      id: batches.id,
      name: batches.name,
      maxMembers: batches.maxMembers,
      startDate: batches.startDate,
      readingDaysPerWeek: batches.readingDaysPerWeek,
      registrationOpen: batches.registrationOpen,
      enrolled: enrolledCount,
    })
    .from(batches)
    .leftJoin(batchMemberships, eq(batchMemberships.batchId, batches.id))
    .where(eq(batches.id, batchId))
    .groupBy(
      batches.id,
      batches.name,
      batches.maxMembers,
      batches.startDate,
      batches.readingDaysPerWeek,
      batches.registrationOpen,
    )
    .limit(1);

  const batch = rows[0];

  if (!batch) {
    return null;
  }

  const enrolled = Number(batch.enrolled ?? 0);

  return {
    id: batch.id,
    name: batch.name,
    enrolled,
    maxMembers: batch.maxMembers,
    startDate: batch.startDate,
    readingDaysPerWeek: batch.readingDaysPerWeek,
    isFull: !batch.registrationOpen || enrolled >= batch.maxMembers,
  };
}
