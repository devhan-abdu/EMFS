import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { batches, batchMemberships } from "@/db/schema";

export type PublicBatchSummary = {
  id: string;
  name: string;
  enrolled: number;
  maxMembers: number;
  startDate: string | null;
  isFull: boolean;
};

export async function getOpenBatchesForPublic(): Promise<PublicBatchSummary[]> {
  const rows = await db
    .select({
      id: batches.id,
      name: batches.name,
      maxMembers: batches.maxMembers,
      startDate: batches.startDate,
      enrolled: sql<number>`count(${batchMemberships.id}) filter (where ${batchMemberships.status} in ('approved', 'active', 'grace'))`,
    })
    .from(batches)
    .leftJoin(batchMemberships, eq(batchMemberships.batchId, batches.id))
    .where(eq(batches.registrationOpen, true))
    .groupBy(batches.id, batches.name, batches.maxMembers, batches.startDate)
    .orderBy(asc(batches.startDate), asc(batches.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    enrolled: Number(row.enrolled ?? 0),
    maxMembers: row.maxMembers,
    startDate: row.startDate,
    isFull: Number(row.enrolled ?? 0) >= row.maxMembers,
  }));
}
